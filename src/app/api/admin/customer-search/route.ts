export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CustomerHit {
  source: 'member' | 'history'
  userId: string | null
  name: string
  company: string
  phone: string
  email: string
  address: string
  lastOrderAt?: string | null
}

const digits = (s: string) => (s || '').replace(/\D/g, '')

// 관리자: 주문자 자동완성 (회원 + 과거 주문 이력 통합 검색)
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const qDigits = digits(q)

  const hits: CustomerHit[] = []

  // 1) 가입 회원 검색 (이름 / 회사명 / 전화번호)
  const perPage = 1000
  for (let page = 1; page <= 20; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    for (const u of users) {
      const m = u.user_metadata || {}
      if (m.withdrawn) continue
      const name = String(m.full_name || m.name || '')
      const company = String(m.company || '')
      const phone = String(m.phone || '')
      const matched =
        name.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && digits(phone).includes(qDigits))
      if (matched) {
        hits.push({
          source: 'member', userId: u.id, name, company, phone,
          email: u.email || '',
          address: String(m.address || ''),
        })
      }
    }
    if (users.length < perPage || hits.length >= 30) break
  }

  // 2) 과거 주문 이력 검색 (비회원 전화주문 포함)
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('user_id,user_name,user_phone,user_email,user_address,memo,created_at')
    .or(`user_name.ilike.%${q}%,user_phone.ilike.%${q}%,user_email.ilike.%${q}%,memo.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(200)

  const seen = new Set(hits.map((h) => digits(h.phone) || h.email))
  for (const o of orders || []) {
    const phone = String(o.user_phone || '')
    const key = digits(phone) || String(o.user_email || '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    // 전화주문 메모에 남긴 업체명 추출: "📞 전화주문 · 업체명"
    const memo = String(o.memo || '')
    const company = memo.match(/전화주문\s*·\s*([^|·\n]+)/)?.[1]?.trim() || ''
    hits.push({
      source: 'history', userId: (o.user_id as string) || null,
      name: String(o.user_name || ''), company, phone,
      email: String(o.user_email || ''),
      address: String(o.user_address || ''),
      lastOrderAt: o.created_at as string,
    })
    if (hits.length >= 30) break
  }

  // 회원을 앞에 배치
  hits.sort((a, b) => (a.source === b.source ? 0 : a.source === 'member' ? -1 : 1))

  return NextResponse.json({ results: hits.slice(0, 12) })
}
