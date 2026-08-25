export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getShippingFee } from '@/lib/shipping'
import { sendOrderStatusMail, sendAdminNewOrderMail } from '@/lib/order-mail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, delivery } = await req.json()
  if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

  // 寃ъ쟻 ?뺣낫 議고쉶
  const { data: quote, error: quoteErr } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ error: 'quote not found' }, { status: 404 })
  }

  // ?대? 泥섎━??寃쎌슦 以묐났 諛⑹?
  if (quote.status === 'paid' && quote.order_id) {
    return NextResponse.json({ success: true, orderId: quote.order_id })
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
      total_amount: payTotal,
      status: 'paid',
      memo: `견적주문 (${quote.product_type})${quote.admin_note ? ' · ' + quote.admin_note : ''} · ${shipLabel}`,
    })
    .select('id')
    .single()

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  // quotes ?곹깭 ?낅뜲?댄듃 + order_id ?곌껐
  await supabaseAdmin
    .from('quotes')
    .update({ status: 'paid', order_id: newOrder.id })
    .eq('id', quoteId)

  // 주문 접수 알림 (고객 + 관리자)
  try {
    await sendOrderStatusMail(supabaseAdmin, newOrder.id, 'ordered')
    await sendAdminNewOrderMail(supabaseAdmin, newOrder.id)
  } catch { /* 메일 실패해도 결제는 정상 */ }

  return NextResponse.json({ success: true, orderId: newOrder.id })
}

