export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { usePoints } from '@/lib/points-server'
import { sendOrderStatusMail } from '@/lib/order-mail'
import { saveProfileAddress } from '@/lib/save-profile-address'
import { insertWithOptional } from '@/lib/safe-insert'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderName, customer, cart, totalAmount, paymentMethod, shippingNote, usedPoints, machineNo, receiptType, receiptInfo, depositorName } = await req.json()

  // 포인트 사용 상한: 구매금액(=결제액+사용포인트)의 20%
  const reqUsed = Math.max(0, Math.round(Number(usedPoints) || 0))
  const purchaseAmount = Number(totalAmount) + reqUsed
  const pointCap = Math.floor(purchaseAmount * 0.2)
  const effectiveUsed = Math.min(reqUsed, pointCap)

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const isBank = (paymentMethod || 'bank_transfer') !== 'CARD'
  // 무통장은 입금자명 기록 (비어 있으면 주문자명)
  const depositor = isBank ? (String(depositorName || '').trim() || String(customer.name || '').trim() || null) : null

  const { data: newOrder, error: orderErr } = await insertWithOptional(supabaseAdmin, 'orders', {
    user_id: user?.id || null,
    user_name: customer.name,
    user_email: customer.email,
    user_phone: customer.phone,
    user_address: customer.address,
    order_name: orderName || null,
    total_amount: totalAmount,
    used_points: effectiveUsed,
    machine_no: machineNo || null,
    receipt_type: receiptType && receiptType !== 'none' ? receiptType : null,
    receipt_info: receiptInfo || null,
    depositor_name: depositor,
    status: 'pending',
    payment_method: paymentMethod || 'bank_transfer',
    memo: `${paymentMethod === 'CARD' ? '카드결제' : '무통장입금'} 바로주문${orderName ? ` · ${orderName}` : ''}${shippingNote ? ` · ${shippingNote}` : ''}${effectiveUsed ? ` · 포인트 ${effectiveUsed.toLocaleString()}P 사용` : ''}${depositor && depositor !== customer.name ? ` · 입금자 ${depositor}` : ''}`,
  }, ['depositor_name']) as { data: { id: string } | null; error: { message: string } | null }

  if (orderErr || !newOrder) {
    return NextResponse.json({ error: orderErr?.message || 'order insert failed' }, { status: 500 })
  }

  // 회원정보에 주소가 없으면 주문 시 입력한 배송지를 저장
  try { await saveProfileAddress(supabaseAdmin, user?.id, customer) } catch { /* 무시 */ }

  const items = cart.map((item: {
    productId: string
    quantity: number
    unitPrice: number
    cutting: boolean
    cuttingPrice: number
    requestNote: string
    dueDate: string | null
    filePath?: string | null
    fileName?: string | null
  }) => ({
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
