export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { usePoints } from '@/lib/points-server'
import { sendOrderStatusMail } from '@/lib/order-mail'
import { saveProfileAddress } from '@/lib/save-profile-address'
import { getLoginUser } from '@/lib/admin-auth'
import { priceOrder, type CartInput } from '@/lib/order-price'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface OrderPayload {
  orderName: string
  customer: { name: string; email: string; phone: string; address: string; zonecode?: string; addressDetail?: string }
  cart: CartInput[]
  totalAmount: number
  usedPoints?: number
  userId?: string | null
  shippingNote?: string
  machineNo?: number
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, orderPayload } = await req.json()

  const p = orderPayload as OrderPayload | null
  if (!paymentKey || !orderId || !p?.customer) {
    return NextResponse.json({ success: false, message: '결제 정보가 올바르지 않습니다.' }, { status: 400 })
  }

  // 새로고침 등으로 같은 결제가 다시 들어오면 이미 만든 주문으로 처리
  const { data: dup } = await supabaseAdmin.from('orders').select('id').eq('payment_key', paymentKey).limit(1)
  if (dup && dup[0]) return NextResponse.json({ success: true, already: true })

  // 회원은 로그인 세션 기준 (브라우저가 보낸 userId는 믿지 않음 — 남의 포인트 사용 방지)
  const user = await getLoginUser()
  const userId = user?.id || null

  // 금액을 서버에서 다시 계산해 결제 금액과 다르면 승인하지 않음 (실제 결제 안 됨)
  const pickup = String(p.shippingNote || '').startsWith('직접 수령')
  const priced = await priceOrder(supabaseAdmin, {
    cart: p.cart, zonecode: p.customer.zonecode || '', pickup, requestedPoints: Number(p.usedPoints) || 0, userId,
  })
  if (!priced.ok) return NextResponse.json({ success: false, message: priced.error }, { status: 400 })
  if (Math.round(Number(amount)) !== priced.order.total) {
    return NextResponse.json({
      success: false,
      message: `결제 금액(${Number(amount).toLocaleString()}원)이 주문 금액(${priced.order.total.toLocaleString()}원)과 달라 결제를 진행하지 않았습니다. 새로고침 후 다시 주문해주세요.`,
    }, { status: 400 })
  }

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount: priced.order.total }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ success: false, message: data.message }, { status: 400 })
  }

  // 결제 승인 성공 → 주문 생성 (승인 후에만 1건 생성)
  {
    const effectiveUsed = priced.order.usedPoints
    const { data: newOrder } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        user_name: p.customer.name,
        user_email: p.customer.email,
        user_phone: p.customer.phone,
        user_address: p.customer.address,
        order_name: p.orderName || null,
        total_amount: priced.order.total,
        used_points: effectiveUsed,
        machine_no: p.machineNo || null,
        status: 'paid',
        payment_method: 'CARD',
        payment_key: paymentKey,
        memo: `카드결제 바로주문${p.orderName ? ` · ${p.orderName}` : ''}${p.shippingNote ? ` · ${p.shippingNote}` : ''}${effectiveUsed ? ` · 포인트 ${effectiveUsed.toLocaleString()}P 사용` : ''}`,
      })
      .select('id')
      .single()

    // 회원정보에 주소가 없으면 주문 시 입력한 배송지를 저장
    try { await saveProfileAddress(supabaseAdmin, userId, p.customer) } catch { /* 무시 */ }

    if (newOrder) {
      // 단가·컷팅금액은 서버 계산값으로 저장
      await supabaseAdmin.from('order_items').insert(
        priced.order.items.map((item) => ({
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
      )
    }

    // 포인트 사용 차감 (FIFO) — 20% 상한 적용값
    if (newOrder && effectiveUsed > 0 && userId) {
      try { await usePoints(supabaseAdmin, userId, effectiveUsed, newOrder.id) } catch { /* 무시 */ }
    }

    // 주문 접수 확인메일 (고객)
    if (newOrder) {
      try {
        await sendOrderStatusMail(supabaseAdmin, newOrder.id, 'ordered')
      } catch { /* 메일 실패해도 결제는 정상 */ }
    }
  }

  return NextResponse.json({ success: true, data })
}

