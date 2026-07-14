import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveGrade, POINT_RATES, POINT_EXPIRY_MONTHS, isRollProduct, type Grade } from './grade'

// 관리자 수동 지정 우선, 없으면 지난 달 미터 기반 등급
export async function getEffectiveGrade(admin: SupabaseClient, userId: string): Promise<Grade> {
  const meters = await getUserLastMonthMeters(admin, userId)
  let override = null
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    override = data.user?.user_metadata?.grade_override || null
  } catch { /* 무시 */ }
  return resolveGrade(override, meters).grade
}

const COUNTED_STATUSES = ['paid', 'in_progress', 'shipped', 'delivered']

// 특정 회원의 지난 달 롤(58cm) 미터 → 등급 판정용
export async function getUserLastMonthMeters(admin: SupabaseClient, userId: string): Promise<number> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: orders } = await admin
    .from('orders')
    .select('id,order_items(product_id,quantity)')
    .eq('user_id', userId)
    .in('status', COUNTED_STATUSES)
    .gte('created_at', start)
    .lt('created_at', end)

  let meters = 0
  ;(orders || []).forEach((o) => {
    const items = (o.order_items as Array<{ product_id: string; quantity: number }>) || []
    items.forEach((it) => { if (isRollProduct(it.product_id)) meters += Number(it.quantity) || 0 })
  })
  return meters
}

// 사용 가능 포인트 (만료 안 된 적립분의 남은 잔액 합)
export async function getAvailablePoints(admin: SupabaseClient, userId: string): Promise<number> {
  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('points')
    .select('balance_remaining')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .gt('balance_remaining', 0)
    .gt('expires_at', nowIso)
  return (data || []).reduce((s, r) => s + (Number(r.balance_remaining) || 0), 0)
}

// 상품 금액(배송비 제외) 계산: order_items가 있으면 그 합, 없으면 total_amount(견적 주문은 상품가)
function getProductAmount(order: { total_amount: number | null; order_items?: Array<{ unit_price: number; quantity: number; cutting_price?: number }> }): number {
  const items = order.order_items || []
  if (items.length > 0) {
    return items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) + (Number(it.cutting_price) || 0), 0)
  }
  return Number(order.total_amount) || 0
}

// 배송완료 주문에 대해 등급별 포인트 적립 (중복 방지)
export async function awardPointsForDeliveredOrder(admin: SupabaseClient, orderId: string): Promise<{ earned: number } | null> {
  const { data: order } = await admin
    .from('orders')
    .select('id,user_id,status,total_amount,order_items(unit_price,quantity,cutting_price,product_id)')
    .eq('id', orderId)
    .single()

  if (!order || !order.user_id) return null
  if (order.status !== 'delivered') return null

  // 이미 적립된 주문이면 중복 방지
  const { data: existing } = await admin
    .from('points')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'earn')
    .limit(1)
  if (existing && existing.length > 0) return null

  const grade = await getEffectiveGrade(admin, order.user_id)
  const rate = POINT_RATES[grade.key]
  if (rate <= 0) return null

  const productAmount = getProductAmount(order)
  const earned = Math.floor(productAmount * rate)
  if (earned <= 0) return null

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + POINT_EXPIRY_MONTHS)

  await admin.from('points').insert({
    user_id: order.user_id,
    amount: earned,
    balance_remaining: earned,
    type: 'earn',
    expires_at: expiresAt.toISOString(),
    order_id: orderId,
    memo: `${grade.label} 등급 ${(rate * 100).toFixed(0)}% 적립`,
  })

  return { earned }
}

// 포인트 사용 (FIFO 소진, 오래된 적립분부터). 실제 사용된 금액 반환
export async function usePoints(admin: SupabaseClient, userId: string, requested: number, orderId?: string): Promise<number> {
  if (requested <= 0) return 0
  const available = await getAvailablePoints(admin, userId)
  const use = Math.min(requested, available)
  if (use <= 0) return 0

  const nowIso = new Date().toISOString()
  const { data: earns } = await admin
    .from('points')
    .select('id,balance_remaining')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .gt('balance_remaining', 0)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })

  let remaining = use
  for (const e of earns || []) {
    if (remaining <= 0) break
    const deduct = Math.min(remaining, Number(e.balance_remaining) || 0)
    await admin.from('points').update({ balance_remaining: (Number(e.balance_remaining) || 0) - deduct }).eq('id', e.id)
    remaining -= deduct
  }

  await admin.from('points').insert({
    user_id: userId,
    amount: -use,
    balance_remaining: 0,
    type: 'use',
    order_id: orderId || null,
    memo: '주문 시 사용',
  })

  return use
}
