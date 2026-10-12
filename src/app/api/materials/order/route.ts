export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getMaterialShippingFee, normalizeMaterialShipping, type MaterialShipping } from '@/lib/shipping'
import { usePoints, getAvailablePoints } from '@/lib/points-server'
import { POINT_USE_THRESHOLD } from '@/lib/grade'
import { saveProfileAddress } from '@/lib/save-profile-address'
import { insertWithOptional } from '@/lib/safe-insert'

// 자재 구매 포인트 사용 상한 (구매금액의 5%)
const MATERIAL_POINT_RATE = 0.05

// 토스페이먼츠 서버 인증 (출력 주문 결제와 같은 키)
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'
const tossAuth = () => `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`

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
  // shipping 컬럼이 아직 없어도 실패하지 않도록 전체 조회
  const { data: mats } = await supabaseAdmin.from('materials').select('*').in('id', ids)
  const map = new Map((mats || []).map((m) => [m.id as string, m]))

  const finalItems: { materialId: string; name: string; price: number; qty: number; options?: string | null }[] = []
  // 상품별 택배비 계산용 (서버에서 상품 설정으로 다시 계산)
  const shipItems: { amount: number; qty: number; shipping: MaterialShipping }[] = []
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
    shipItems.push({ amount: price * qty, qty, shipping: normalizeMaterialShipping(m.shipping) })
  }

  const isPickup = b.deliveryMethod === 'pickup'
  const shipping = isPickup ? 0 : getMaterialShippingFee(shipItems, b.zonecode || '').total
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

  // ── 카드 결제: 토스 승인이 끝난 결제만 주문으로 저장 ─────────
  const isCard = b.paymentMethod === 'CARD'
  let paymentKey: string | null = null
  if (isCard) {
    paymentKey = String(b.paymentKey || '').trim()
    const tossOrderId = String(b.tossOrderId || '').trim()
    const amount = Math.round(Number(b.amount))
    if (!paymentKey || !tossOrderId || !Number.isFinite(amount)) {
      return NextResponse.json({ error: '카드 결제 정보가 없습니다. 결제창에서 결제를 진행해주세요.' }, { status: 400 })
    }

    // 새로고침 등으로 같은 결제가 다시 들어오면 이미 만든 주문을 돌려줌
    const { data: dup } = await supabaseAdmin.from('material_orders').select('id,total_amount').eq('payment_key', paymentKey).limit(1)
    if (dup && dup[0]) return NextResponse.json({ success: true, orderId: dup[0].id, total: dup[0].total_amount, already: true })

    // 승인 전에 금액 검증 — 다르면 승인하지 않으므로 실제 결제되지 않음
    if (amount !== total) {
      return NextResponse.json({
        error: `결제 금액(${amount.toLocaleString()}원)이 주문 금액(${total.toLocaleString()}원)과 달라 결제를 진행하지 않았습니다. 다시 시도해주세요.`,
      }, { status: 400 })
    }

    const confirm = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount }),
    })
    if (!confirm.ok) {
      const e = await confirm.json().catch(() => ({}))
      return NextResponse.json({ error: `결제 승인에 실패했습니다. ${e.message || ''}`.trim() }, { status: 400 })
    }
  }

  // 무통장 입금자명·증빙 정보 (카드는 저장하지 않음)
  const isBankPay = !isCard
  const depositor = isBankPay ? (String(b.depositorName || '').trim() || String(b.name || '').trim() || null) : null
  const rType = isBankPay && (b.receiptType === 'tax_invoice' || b.receiptType === 'cash_receipt') ? b.receiptType : null

  const { data: newOrder, error } = await insertWithOptional(supabaseAdmin, 'material_orders', {
    depositor_name: depositor,
    receipt_type: rType,
    receipt_info: rType ? (b.receiptInfo || null) : null,
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
    // 카드는 위에서 토스 승인까지 끝난 경우에만 여기까지 옴
    status: isCard ? 'paid' : 'pending',
    is_paid: isCard,
    payment_method: isCard ? 'CARD' : 'bank_transfer',
    payment_key: isCard ? paymentKey : null,
    memo: `자재구매${isPickup ? ' · 직접 수령' : ` · 배송비 ${shipping.toLocaleString()}원`}${usedPoints ? ` · 포인트 ${usedPoints.toLocaleString()}P 사용` : ''}${b.memo ? ` · ${b.memo}` : ''}`,
  }, ['depositor_name', 'receipt_type', 'receipt_info']) as { data: { id: string } | null; error: { message: string } | null }

  if (error || !newOrder) {
    // 결제는 승인됐는데 주문 저장에 실패하면 고객 돈만 빠지므로 결제를 바로 취소
    if (isCard && paymentKey) {
      try {
        await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
          method: 'POST',
          headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancelReason: '주문 저장 실패로 자동 취소' }),
        })
      } catch { /* 취소 실패는 아래 오류 메시지로 안내 */ }
      return NextResponse.json({ error: '주문 저장 중 오류가 발생해 결제를 취소했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
    }
    return NextResponse.json({ error: error?.message || 'order insert failed' }, { status: 500 })
  }

  // 회원정보에 주소가 없으면 주문 시 입력한 배송지를 저장
  if (!isPickup) {
    try { await saveProfileAddress(supabaseAdmin, user?.id, b) } catch { /* 무시 */ }
  }

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
