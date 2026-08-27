export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] 특정 회원의 로그인/주문 시각 확인 — 관리자 전용
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase().trim()
  if (!q) return NextResponse.json({ error: 'q(이름/이메일) 필요' }, { status: 400 })

  const kst = (iso: string | null | undefined) =>
    iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' KST' : null

  // 회원 검색
  const perPage = 1000
  const found: Record<string, unknown>[] = []
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    for (const u of users) {
      const meta = u.user_metadata || {}
      const name = String(meta.full_name || meta.name || '')
      const company = String(meta.company || '')
      if (
        name.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      ) {
        // 이 회원의 주문 조회
        const { data: orders } = await supabaseAdmin
          .from('orders').select('id,order_no,created_at,status,total_amount')
          .eq('user_id', u.id).order('created_at', { ascending: false }).limit(10)
        const { data: quotes } = await supabaseAdmin
          .from('quotes').select('id,order_no,created_at,status')
          .eq('user_id', u.id).order('created_at', { ascending: false }).limit(10)

        found.push({
          name, company, email: u.email,
          userId: u.id,
          created_at_KST: kst(u.created_at),
          last_sign_in_at_KST: kst(u.last_sign_in_at),
          last_sign_in_raw: u.last_sign_in_at,
          email_confirmed: !!u.email_confirmed_at,
          provider: u.app_metadata?.provider,
          orders: (orders || []).map((o) => ({ order_no: o.order_no, created_KST: kst(o.created_at), status: o.status, amount: o.total_amount })),
          quotes: (quotes || []).map((o) => ({ order_no: o.order_no, created_KST: kst(o.created_at), status: o.status })),
        })
      }
    }
    if (users.length < perPage) break
  }

  return NextResponse.json({ nowKST: kst(new Date().toISOString()), count: found.length, members: found })
}
