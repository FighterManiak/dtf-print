export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { normCompany } from '@/lib/company'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KINDS = ['meeting', 'call', 'visit', 'etc']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') return null
  return user!
}

// 테이블이 아직 없을 때 알아보기 쉬운 안내
function dbError(msg: string) {
  if (/member_notes/.test(msg) && /(does not exist|schema cache|relation)/i.test(msg)) {
    return NextResponse.json({ error: '영업일지 테이블이 없습니다. supabase-member-notes.sql 을 먼저 실행해주세요.', needsSql: true }, { status: 500 })
  }
  return NextResponse.json({ error: msg }, { status: 500 })
}

async function memberCompany(userId: string) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
  const m = data?.user?.user_metadata || {}
  return {
    name: String(m.full_name || m.name || data?.user?.email || ''),
    company: String(m.company || '').trim(),
  }
}

// 조회
// - ?summary=1 : 회원 목록 표시용 (기록 id·회원·업체키·날짜만)
// - ?userId=   : 해당 회원 + 같은 업체 회원들의 기록 전체
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const sp = new URL(req.url).searchParams

  if (sp.get('summary')) {
    const rows: { id: string; user_id: string | null; company_key: string | null; note_date: string }[] = []
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await supabaseAdmin.from('member_notes')
        .select('id,user_id,company_key,note_date')
        .order('note_date', { ascending: false })
        .range(from, from + 999)
      if (error) return dbError(error.message)
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < 1000) break
    }
    return NextResponse.json({ rows })
  }

  const userId = sp.get('userId') || ''
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })
  const { name, company } = await memberCompany(userId)
  const key = normCompany(company)

  // 이 회원의 기록 + 같은 업체(다른 담당자)의 기록을 합쳐서 반환
  const mine = await supabaseAdmin.from('member_notes').select('*').eq('user_id', userId)
  if (mine.error) return dbError(mine.error.message)
  const byId = new Map<string, Record<string, unknown>>()
  ;(mine.data || []).forEach((n) => byId.set(n.id, n))
  if (key) {
    const same = await supabaseAdmin.from('member_notes').select('*').eq('company_key', key)
    if (same.error) return dbError(same.error.message)
    ;(same.data || []).forEach((n) => byId.set(n.id, n))
  }
  // 작성·수정한 관리자의 이름 (이메일로 찾아 붙임 — 이름이 없으면 이메일 그대로)
  const names = await adminNames()
  const notes = [...byId.values()]
    .sort((a, b) => String(b.note_date).localeCompare(String(a.note_date)) || String(b.created_at).localeCompare(String(a.created_at)))
    .map((n) => ({
      ...n,
      created_by_name: names[String(n.created_by || '').toLowerCase()] || null,
      updated_by_name: names[String(n.updated_by || '').toLowerCase()] || null,
    }))

  return NextResponse.json({ member: { userId, name, company }, notes })
}

// 이메일 → 이름 (나중에 관리자 권한이 해제된 계정도 이름이 보이도록 전체 계정 기준)
async function adminNames(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    users.forEach((u) => {
      const nm = String(u.user_metadata?.full_name || u.user_metadata?.name || '').trim()
      if (u.email && nm) map[u.email.toLowerCase()] = nm
    })
    if (users.length < 1000) break
  }
  return map
}

// 작성
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()

  const userId = String(b.userId || '').trim()
  const content = String(b.content || '').trim()
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })
  if (!content) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  if (content.length > 5000) return NextResponse.json({ error: '내용은 5,000자까지 입력할 수 있습니다.' }, { status: 400 })

  const { company } = await memberCompany(userId)
  const { data, error } = await supabaseAdmin.from('member_notes').insert({
    user_id: userId,
    company_key: normCompany(company) || null,
    company_name: company || null,
    note_date: DATE_RE.test(b.noteDate) ? b.noteDate : kstToday(),
    kind: KINDS.includes(b.kind) ? b.kind : 'meeting',
    content,
    created_by: admin.email || null,
  }).select('*').single()
  if (error) return dbError(error.message)
  return NextResponse.json({ note: data })
}

// 수정
export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_by: admin.email || null, updated_at: new Date().toISOString() }
  if (b.content !== undefined) {
    const c = String(b.content).trim()
    if (!c) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
    if (c.length > 5000) return NextResponse.json({ error: '내용은 5,000자까지 입력할 수 있습니다.' }, { status: 400 })
    patch.content = c
  }
  if (b.noteDate !== undefined && DATE_RE.test(b.noteDate)) patch.note_date = b.noteDate
  if (b.kind !== undefined && KINDS.includes(b.kind)) patch.kind = b.kind

  const { data, error } = await supabaseAdmin.from('member_notes').update(patch).eq('id', b.id).select('*').single()
  if (error) return dbError(error.message)
  return NextResponse.json({ note: data })
}

// 삭제
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  const { error } = await supabaseAdmin.from('member_notes').delete().eq('id', id)
  if (error) return dbError(error.message)
  return NextResponse.json({ success: true })
}
