export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { usePoints } from '@/lib/points-server'
import { sendOrderStatusMail, sendAdminNewOrderMail } from '@/lib/order-mail'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface OrderPayload {
  orderName: string
  customer: { name: string; email: string; phone: string; address: string }
  cart: Array<{ productId: string; quantity: number; unitPrice: number; cutting: boolean; cuttingPrice: number; requestNote: string; dueDate: string | null; filePath?: string | null; fileName?: string | null }>
  totalAmount: number
  usedPoints?: number
  userId?: string | null
  shippingNote?: string
  machineNo?: number
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, orderName, orderPayload, dbOrderId } = await req.json()
  void orderName

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ success: false, message: data.message }, { status: 400 })
  }

  // 결제 승인 성공 → 주문 생성 (승인 후에만 1건 생성)
  const p = orderPayload as OrderPayload | null
  if (p) {
    // 포인트 사용 상한: 구매금액(=결제액+사용포인트)의 20%
    const reqUsed = Math.max(0, Math.round(Number(p.usedPoints) || 0))
    const purchaseAmount = Number(p.totalAmount) + reqUsed
    const effectiveUsed = Math.min(reqUsed, Math.floor(purchaseAmount * 0.2))
    const { data: newOrder } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: p.userId || null,
        user_name: p.customer.name,
        user_email: p.customer.email,
        user_phone: p.customer.phone,
        user_address: p.customer.address,
        order_name: p.orderName || null,
        total_amount: p.totalAmount,
        used_points: effectiveUsed,
        machine_no: p.machineNo || null,
        status: 'paid',
        payment_method: 'CARD',
        payment_key: paymentKey,
        memo: `카드결제 바로주문${p.orderName ? ` · ${p.orderName}` : ''}${p.shippingNote ? ` · ${p.shippingNote}` : ''}${effectiveUsed ? ` · 포인트 ${effectiveUsed.toLocaleString()}P 사용` : ''}`,
      })
      .select('id')
      .single()

    if (newOrder && p.cart?.length) {
      await supabaseAdmin.from('order_items').insert(
        p.cart.map((item) => ({
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
    if (newOrder && effectiveUsed > 0 && p.userId) {
      try { await usePoints(supabaseAdmin, p.userId, effectiveUsed, newOrder.id) } catch { /* 무시 */ }
    }

    // 주문 접수 알림 (고객 확인메일 + 관리자 신규주문 알림)
    if (newOrder) {
      try {
        await sendOrderStatusMail(supabaseAdmin, newOrder.id, 'ordered')
        await sendAdminNewOrderMail(supabaseAdmin, newOrder.id)
      } catch { /* 메일 실패해도 결제는 정상 */ }
    }
  } else if (dbOrderId) {
    // 구버전 호환: 이미 생성된 주문 업데이트
    await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', payment_method: 'CARD', payment_key: paymentKey })
      .eq('id', dbOrderId)
  }

  return NextResponse.json({ success: true, data })
}

