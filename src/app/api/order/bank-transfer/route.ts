export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { usePoints } from '@/lib/points-server'
import { sendOrderStatusMail } from '@/lib/order-mail'
import { saveProfileAddress } from '@/lib/save-profile-address'
import { insertWithOptional } from '@/lib/safe-insert'
import { priceOrder } from '@/lib/order-price'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderName, customer, cart, totalAmount, paymentMethod, shippingNote, usedPoints, machineNo, receiptType, receiptInfo, depositorName } = await req.json()
  if (!customer || !Array.isArray(cart)) return NextResponse.json({ error: '주문 정보가 올바르지 않습니다.' }, { status: 400 })
  // 카드 주문은 결제 승인(/api/payment/confirm)을 거쳐야만 생성됨
  if (paymentMethod === 'CARD') return NextResponse.json({ error: '카드 결제는 결제창을 통해 진행해주세요.' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // 금액·단가를 서버에서 다시 계산 — 화면 금액과 다르면 주문을 받지 않음
  const priced = await priceOrder(supabaseAdmin, {
    cart, zonecode: customer.zonecode || '', pickup: String(shippingNote || '').startsWith('직접 수령'),
    requestedPoints: Number(usedPoints) || 0, userId: user?.id || null,
  })
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: 400 })
  if (Math.round(Number(totalAmount)) !== priced.order.total) {
    return NextResponse.json({ error: `주문 금액이 변경되었습니다 (${priced.order.total.toLocaleString()}원). 새로고침 후 다시 주문해주세요.` }, { status: 400 })
  }
  const effectiveUsed = priced.order.usedPoints

  const isBank = true
  // 무통장은 입금자명 기록 (비어 있으면 주문자명)
  const depositor = isBank ? (String(depositorName || '').trim() || String(customer.name || '').trim() || null) : null

  const { data: newOrder, error: orderErr } = await insertWithOptional(supabaseAdmin, 'orders', {
    user_id: user?.id || null,
    user_name: customer.name,
    user_email: customer.email,
    user_phone: customer.phone,
    user_address: customer.address,
    order_name: orderName || null,
    total_amount: priced.order.total,
    used_points: effectiveUsed,
    machine_no: machineNo || null,
    receipt_type: receiptType && receiptType !== 'none' ? receiptType : null,
    receipt_info: receiptInfo || null,
    depositor_name: depositor,
    status: 'pending',
    payment_method: 'bank_transfer',
    memo: `무통장입금 바로주문${orderName ? ` · ${orderName}` : ''}${shippingNote ? ` · ${shippingNote}` : ''}${effectiveUsed ? ` · 포인트 ${effectiveUsed.toLocaleString()}P 사용` : ''}${depositor && depositor !== customer.name ? ` · 입금자 ${depositor}` : ''}`,
  }, ['depositor_name']) as { data: { id: string } | null; error: { message: string } | null }

  if (orderErr || !newOrder) {
    return NextResponse.json({ error: orderErr?.message || 'order insert failed' }, { status: 500 })
  }

  // 회원정보에 주소가 없으면 주문 시 입력한 배송지를 저장
  try { await saveProfileAddress(supabaseAdmin, user?.id, customer) } catch { /* 무시 */ }

  // 단가·컷팅금액은 서버 계산값으로 저장
  const items = priced.order.items.map((item) => ({
    order_id: newOrder.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    cutting: item.cutting,
    cutting_price: item.cuttingPrice,
    request_note: item.requestNote || null,
    due_date: item.dueDate || null,
    file_url: item.filePath || null,
    file_name: item.fileName || null,
  }))

  await supabaseAdmin.from('order_items').insert(items)

  // 포인트 사용 차감 (FIFO) — 20% 상한 적용값
  if (effectiveUsed > 0 && user?.id) {
    try { await usePoints(supabaseAdmin, user.id, effectiveUsed, newOrder.id) } catch { /* 무시 */ }
  }

  // 주문 접수 확인메일 (고객)
  try {
    await sendOrderStatusMail(supabaseAdmin, newOrder.id, 'ordered')
  } catch { /* 메일 실패해도 주문은 정상 */ }

  return NextResponse.json({ success: true, orderId: newOrder.id })
}
