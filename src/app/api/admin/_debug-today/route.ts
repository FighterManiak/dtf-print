export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] 오늘 매출로 집계되는 주문 확인 — 관리자 전용
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
  const ky = kstNow.getUTCFullYear(), km = kstNow.getUTCMonth(), kd = kstNow.getUTCDate()
  const todayStart = new Date(Date.UTC(ky, km, kd) - 9 * 3600 * 1000).toISOString()
  const revenueStatuses = ['paid', 'in_progress', 'shipped', 'delivered']

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, created_at, memo, payment_method, user_name')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })

  const todayRevenueOrders = (orders || []).filter((o) => revenueStatuses.includes(o.status as string))
  const todayRevenue = todayRevenueOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)

  return NextResponse.json({
    kstNow: kstNow.toISOString().replace('T', ' ').slice(0, 19) + ' (KST)',
    todayStartUtc: todayStart,
    todayRevenue,
    todayAllOrders: orders?.length || 0,
    revenueOrders: todayRevenueOrders,
    allTodayOrders: orders,
  })
}
