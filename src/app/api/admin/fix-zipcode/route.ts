export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ZIP_RE = /^\(?\s*(\d{5}|\d{3}-\d{3})\s*\)?\s*/

function splitAddr(full: string | null | undefined): { zip: string; addr: string } {
  const s = (full || '').trim()
  if (!s) return { zip: '', addr: '' }
  const m = s.match(/^\(?\s*(\d{5}|\d{3}-\d{3})\s*\)?\s*(.*)$/)
  if (m) return { zip: m[1].replace('-', ''), addr: m[2].trim() }
  return { zip: '', addr: s }
}

// 주소 비교용 정규화 — 공백/기호 제거 후 앞 12자로 비교
function normAddr(a: string): string {
  return a.replace(ZIP_RE, '').replace(/[\s,.\-()]/g, '').slice(0, 12)
}

const digits = (s: string) => (s || '').replace(/\D/g, '')

interface Row {
  table: 'orders' | 'quotes'
  id: string
  order_no: string | null
  user_name: string | null
  user_phone: string | null
  address: string
  suggestZip: string
  suggestFrom: string
}

async function collect() {
  // 1) 회원 프로필의 (우편번호, 주소) 수집 — 전화번호로도 매칭
  const byPhone: Record<string, { zip: string; addr: string }> = {}
  const profiles: { zip: string; norm: string }[] = []
  for (let page = 1; page <= 20; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    users.forEach((u) => {
      const m = u.user_metadata || {}
      const zip = String(m.zonecode || '').replace(/\D/g, '')
      const addr = String(m.address || '')
      if (zip && addr) {
        profiles.push({ zip, norm: normAddr(addr) })
        const ph = digits(String(m.phone || ''))
        if (ph) byPhone[ph] = { zip, addr }
      }
    })
    if (users.length < 1000) break
  }

  // 2) 이미 우편번호가 있는 주문들에서 (정규화주소 → 우편번호) 사전 구축
  const known: Record<string, string> = {}
  profiles.forEach((p) => { known[p.norm] = p.zip })

  const missing: Row[] = []
  for (const table of ['orders', 'quotes'] as const) {
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('id,order_no,user_name,user_phone,user_address')
        .not('user_address', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, from + 999)
      if (error || !data || data.length === 0) break

      data.forEach((r) => {
        const full = String(r.user_address || '')
        if (!full || full === '직접 수령') return
        const { zip, addr } = splitAddr(full)
        if (zip) { known[normAddr(addr)] = zip; return }
        missing.push({
          table, id: r.id as string,
          order_no: (r.order_no as string) || null,
          user_name: (r.user_name as string) || null,
          user_phone: (r.user_phone as string) || null,
          address: addr, suggestZip: '', suggestFrom: '',
        })
      })
      if (data.length < 1000) break
    }
  }

  // 3) 후보 우편번호 추정 — 같은 주소 → 회원 전화번호 순
  missing.forEach((m) => {
    const hit = known[normAddr(m.address)]
    if (hit) { m.suggestZip = hit; m.suggestFrom = '동일 주소 기록'; return }
    const ph = digits(m.user_phone || '')
    const p = ph ? byPhone[ph] : null
    if (p && normAddr(p.addr) === normAddr(m.address)) {
      m.suggestZip = p.zip; m.suggestFrom = '회원 정보'
    }
  })

  return missing
}

// 우편번호 누락 주문 현황
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const rows = await collect()
  return NextResponse.json({
    rows,
    total: rows.length,
    autoFixable: rows.filter((r) => r.suggestZip).length,
  })
}

// 우편번호 채우기 — items: [{ table, id, zip }] / 비우면 추정된 건 일괄 적용
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  let targets: { table: string; id: string; zip: string }[] = Array.isArray(body.items) ? body.items : []

  if (targets.length === 0) {
    const rows = await collect()
    targets = rows.filter((r) => r.suggestZip).map((r) => ({ table: r.table, id: r.id, zip: r.suggestZip }))
  }

  let updated = 0
  for (const t of targets) {
    const zip = String(t.zip || '').replace(/\D/g, '')
    if (!/^\d{5}$/.test(zip)) continue
    if (t.table !== 'orders' && t.table !== 'quotes') continue

    const { data: cur } = await supabaseAdmin
      .from(t.table).select('user_address').eq('id', t.id).single()
    const full = String(cur?.user_address || '')
    if (!full || full === '직접 수령') continue
    const { zip: existing, addr } = splitAddr(full)
    if (existing) continue // 이미 있으면 건드리지 않음

    const { error } = await supabaseAdmin
      .from(t.table).update({ user_address: `(${zip}) ${addr}` }).eq('id', t.id)
    if (!error) updated++
  }

  return NextResponse.json({ success: true, updated })
}
