export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getShippingFee } from '@/lib/shipping'
import { usePoints, getAvailablePoints } from '@/lib/points-server'
import { POINT_USE_THRESHOLD } from '@/lib/grade'

// 자재 구매 포인트 사용 상한 (구매금액의 5%)
const MATERIAL_POINT_RATE = 0.05

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 자재 주문 생성 (무통장/카드)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const b = await req.json()

  const items = Array.isArray(b.items) ? b.items : []
  if (items.length === 0) return NextResponse.json({ error: '주문 상품이 없습니다.' }, { status: 400 })
  if (!String(b.name || '').trim()) return NextResponse.json({ error: '주문자 이름을 입력해주세요.' }, { status: 400 })

  // 가격은 서버에서 다시 계산 (조작 방지)
  const ids = items.map((i: { materialId: string }) => i.materialId)
  const { data: mats } = await supabaseAdmin.from('materials').select('id,name,price,unit,stock,is_active,options').in('id', ids)
  const map = new Map((mats || []).map((m) => [m.id as string, m]))

  const finalItems: { materialId: string; name: string; price: number; qty: number; options?: string | null }[] = []
  let productAmount = 0
  for (const it of items) {
    const m = map.get(it.materialId)
    if (!m || !m.is_active) return NextResponse.json({ error: '판매하지 않는 상품이 포함되어 있습니다.' }, { status: 400 })
    const qty = Math.max(1, Math.round(Number(it.qty) || 1))
    if (m.stock != null && qty > m.stock) {
      return NextResponse.json({ error: `${m.name} 재고가 부족합니다. (남은 수량 ${m.stock})` }, { status: 400 })
    }

    // 선택 옵션의 추가금도 서버에서 다시 계산 (조작 방지)
    const optDefs = Array.isArray(m.options) ? m.options as { name: string; values: { label: string; addPrice: number }[] }[] : []
    const picked = String(it.options || '')
    let addPrice = 0
    for (const od of optDefs) {
      // "옵션명: 값" 형태에서 선택값 추출
      const found = od.values.find((v) => picked.includes(`${od.name}: ${v.label}`))
      if (!found) return NextResponse.json({ error: `${m.name}의 "${od.name}" 옵션을 선택해주세요.` }, { status: 400 })
      addPrice += Number(found.addPrice) || 0
    }

    const price = (Number(m.price) || 0) + addPrice
    productAmount += price * qty
    finalItems.push({ materialId: m.id as string, name: m.name as string, price, qty, options: picked || null })
  }

  const isPickup = b.deliveryMethod === 'pickup'
  const shipping = isPickup ? 0 : getShippingFee(productAmount, b.zonecode || '').total
  const payable = productAmount + shipping

  // 포인트 사용 — 자재 구매는 구매금액의 최대 5% (로그인 + 보유 기준 충족 시)
  let usedPoints = 0
  if (user?.id) {
    const requested = Math.max(0, Math.round(Number(b.usedPoints) || 0))
    if (requested > 0) {
      const available = await getAvailablePoints(supabaseAdmin, user.id)
      if (available >= POINT_USE_THRESHOLD) {
        const cap = Math.floor(payable * MATERIAL_POINT_RATE)
        usedPoints = Math.max(0, Math.min(requested, available, cap, payable - 100))
      }
    }
  }
  const total = payable - usedPoints

  const address = isPickup
    ? '직접 수령'
    : `${b.zonecode ? `(${b.zonecode}) ` : ''}${b.address || ''}${b.addressDetail ? ` ${b.addressDetail}` : ''}`.trim()

  const orderName = finalItems.length === 1
    ? finalItems[0].name
    : `${finalItems[0].name} 외 ${finalItems.length - 1}건`

  const { data: newOrder, error } = await supabaseAdmin.from('material_orders').insert({
    user_id: user?.id || null,
    user_name: String(b.name).trim(),
    user_email: String(b.email || user?.email || '').trim() || null,
    user_phone: String(b.phone || '').trim() || null,
    user_address: address || null,
    order_name: orderName,
    items: finalItems,
    product_amount: productAmount,
    shipping_fee: shipping,
    used_points: usedPoints,
    total_amount: total,
    status: b.paymentMethod === 'CARD' ? 'paid' : 'pending',
    is_paid: b.paymentMethod === 'CARD',
    payment_method: b.paymentMethod === 'CARD' ? 'CARD' : 'bank_transfer',
    payment_key: b.paymentKey || null,
    memo: `자재구매${isPickup ? ' · 직접 수령' : ` · 배송비 ${shipping.toLocaleString()}원`}${usedPoints ? ` · 포인트 ${usedPoints.toLocaleString()}P 사용` : ''}${b.memo ? ` · ${b.memo}` : ''}`,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 포인트 차감 (FIFO)
  if (usedPoints > 0 && user?.id) {
    try { await usePoints(supabaseAdmin, user.id, usedPoints, newOrder.id) } catch { /* 무시 */ }
  }

  // 재고 차감
  for (const it of finalItems) {
    const m = map.get(it.materialId)
    if (m?.stock != null) {
      await supabaseAdmin.from('materials').update({ stock: Math.max(0, (m.stock as number) - it.qty) }).eq('id', it.materialId)
    }
  }

  return NextResponse.json({ success: true, orderId: newOrder.id, total })
}

// 내 자재 주문 내역
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabaseAdmin
    .from('material_orders').select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}
