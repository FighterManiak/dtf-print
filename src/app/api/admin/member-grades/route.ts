export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isRollProduct } from '@/lib/grade'

// 지난 달(전월 1일~말일) 롤 출력(58cm) 미터를 회원별로 합산
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COUNTED_STATUSES = ['paid', 'in_progress', 'shipped', 'delivered']

export async function GET() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 지난 달 주문 (완료 계열 상태) + 상품
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id,user_id,status,created_at,order_items(product_id,quantity)')
    .in('status', COUNTED_STATUSES)
    .gte('created_at', start)
    .lt('created_at', end)

  // 견적 주문(롤): order_items가 없으므로 quote.quoted_quantity에서 미터 확보
  const { data: rollQuotes } = await supabaseAdmin
    .from('quotes')
    .select('order_id,user_id,quoted_quantity,product_type')
    .eq('product_type', 'roll_58')
    .not('order_id', 'is', null)

  const quoteMetersByOrder: Record<string, number> = {}
  ;(rollQuotes || []).forEach((q) => {
    if (q.order_id) quoteMetersByOrder[q.order_id] = (quoteMetersByOrder[q.order_id] || 0) + (Number(q.quoted_quantity) || 0)
  })

  // 회원별 미터 합산
  const metersByUser: Record<string, number> = {}
  ;(orders || []).forEach((o) => {
    if (!o.user_id) return
    let m = 0
    const items = (o.order_items as Array<{ product_id: string; quantity: number }>) || []
    items.forEach((it) => { if (isRollProduct(it.product_id)) m += Number(it.quantity) || 0 })
    if (m === 0 && quoteMetersByOrder[o.id]) m += quoteMetersByOrder[o.id]
    metersByUser[o.user_id] = (metersByUser[o.user_id] || 0) + m
  })

  return NextResponse.json({ metersByUser, period: { start, end } })
}
