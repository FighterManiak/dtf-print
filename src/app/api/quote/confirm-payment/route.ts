export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getShippingFee } from '@/lib/shipping'
import { sendOrderStatusMail } from '@/lib/order-mail'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, delivery, paymentKey, orderId: tossOrderId, amount } = await req.json()
  if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

  // 견적 정보 조회
  const { data: quote, error: quoteErr } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ error: 'quote not found' }, { status: 404 })
  }

  // 이미 처리된 경우 중복 방지
  if (quote.status === 'paid' && quote.order_id) {
    return NextResponse.json({ success: true, orderId: quote.order_id })
  }

  // 카드결제 승인 — 토스에 승인 요청을 해야 실제로 결제가 완료됨
  let approvedKey: string | null = null
  if (paymentKey && tossOrderId && amount) {
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount }),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.message || '결제 승인에 실패했습니다.' }, { status: 400 })
    }
    approvedKey = paymentKey
  }

  // 배송비 계산 — 직접수령 0원, 택배는 지역 추가배송비 포함
  const product = Number(quote.total_amount) || 0
  const isPickup = delivery?.method === 'pickup'
  const shipTotal = isPickup ? 0 : getShippingFee(product, delivery?.zonecode || '').total
  const payTotal = product + shipTotal
  const fullAddress = isPickup
    ? '직접 수령'
    : `${delivery?.zonecode ? `(${delivery.zonecode}) ` : ''}${delivery?.address || quote.user_address || ''}${delivery?.addressDetail ? ` ${delivery.addressDetail}` : ''}`.trim()
  const shipLabel = isPickup ? '직접 수령 (배송비 없음)' : `배송비 ${shipTotal.toLocaleString()}원`

  // orders 테이블에 주문 생성
  const { data: newOrder, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: quote.user_id,
      user_email: quote.user_email,
      user_name: quote.user_name,
      user_phone: quote.user_phone,
      user_address: fullAddress || quote.user_address,
      // 견적번호를 그대로 승계 (같은 건이 두 개의 번호를 갖지 않도록)
      order_no: quote.order_no || null,
      total_amount: payTotal,
      status: 'paid',
      is_paid: true,
      payment_method: approvedKey ? 'CARD' : null,
      payment_key: approvedKey,
      memo: `견적주문 (${quote.product_type})${quote.admin_note ? ' · ' + quote.admin_note : ''} · ${shipLabel}${approvedKey ? ' · 카드결제' : ''}`,
    })
    .select('id')
    .single()

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  // quotes 상태 업데이트 + order_id 연결
  await supabaseAdmin
    .from('quotes')
    .update({ status: 'paid', order_id: newOrder.id })
    .eq('id', quoteId)

  // 주문 접수 확인메일 (고객)
  try {
    await sendOrderStatusMail(supabaseAdmin, newOrder.id, 'ordered')
  } catch { /* 메일 실패해도 결제는 정상 */ }

  return NextResponse.json({ success: true, orderId: newOrder.id })
}
