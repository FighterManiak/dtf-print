export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] 송장 등록 현황 확인 — 관리자 전용
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const kst = (iso: string | null) =>
    iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ') : null

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('order_no, status, carrier, tracking_number, created_at, user_name')
    .in('status', ['shipped', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(50)

  const list = orders || []
  const withTracking = list.filter((o) => o.tracking_number)
  const without = list.filter((o) => !o.tracking_number)

  return NextResponse.json({
    설명: '출고/배송완료 상태 주문의 송장 등록 현황 (최근 50건)',
    출고배송완료_총건수: list.length,
    송장등록됨: withTracking.length,
    송장없음: without.length,
    송장등록_예시: withTracking.slice(0, 5).map((o) => ({
      주문번호: o.order_no, 주문자: o.user_name, 상태: o.status,
      택배사: o.carrier, 송장: o.tracking_number, 주문일: kst(o.created_at),
    })),
    송장없는_주문: without.slice(0, 10).map((o) => ({
      주문번호: o.order_no, 주문자: o.user_name, 상태: o.status, 주문일: kst(o.created_at),
    })),
  })
}
