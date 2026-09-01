export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] 특정 회원의 포인트 적립/사용 내역 상세 확인
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase().trim()
  if (!q) return NextResponse.json({ error: 'q(이름/회사/이메일) 필요' }, { status: 400 })

  const kst = (iso: string | null | undefined) =>
    iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ') : null

  // 회원 찾기
  let target: { id: string; email?: string; meta: Record<string, unknown> } | null = null
  const perPage = 1000
  for (let page = 1; page <= 100 && !target; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    for (const u of users) {
      const meta = u.user_metadata || {}
      const hay = `${meta.full_name || ''} ${meta.name || ''} ${meta.company || ''} ${u.email || ''}`.toLowerCase()
      if (hay.includes(q)) { target = { id: u.id, email: u.email, meta }; break }
    }
    if (users.length < perPage) break
  }
  if (!target) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 })

  // 포인트 내역
  const { data: points } = await supabaseAdmin
    .from('points').select('*').eq('user_id', target.id).order('created_at', { ascending: false })

  const nowIso = new Date().toISOString()
  const rows = points || []
  const earn = rows.filter((r) => r.type === 'earn')
  const use = rows.filter((r) => r.type === 'use')
  const revoke = rows.filter((r) => r.type === 'revoke')
  const available = earn
    .filter((r) => (Number(r.balance_remaining) || 0) > 0 && r.expires_at && r.expires_at > nowIso)
    .reduce((s, r) => s + (Number(r.balance_remaining) || 0), 0)

  // 이 회원의 주문(적립 근거 확인용)
  const { data: orders } = await supabaseAdmin
    .from('orders').select('id,order_no,status,total_amount,created_at,is_paid')
    .eq('user_id', target.id).order('created_at', { ascending: false }).limit(20)

  return NextResponse.json({
    회원: {
      이름: target.meta.full_name || target.meta.name,
      회사: target.meta.company,
      이메일: target.email,
      등급지정: target.meta.grade_override || null,
    },
    요약: {
      사용가능: available,
      누적적립: earn.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      누적사용: use.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0),
      환수: revoke.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0),
      적립건수: earn.length,
    },
    포인트내역: rows.map((r) => ({
      일시: kst(r.created_at), 종류: r.type, 금액: r.amount,
      잔여: r.balance_remaining, 만료: kst(r.expires_at),
      주문ID: r.order_id, 메모: r.memo,
    })),
    주문내역: (orders || []).map((o) => ({
      주문번호: o.order_no, 일시: kst(o.created_at), 상태: o.status,
      금액: o.total_amount, 입금: o.is_paid, id: o.id,
    })),
  })
}
