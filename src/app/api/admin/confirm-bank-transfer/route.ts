export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { awardPointsForDeliveredOrder } from '@/lib/points-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, orderId, targetStatus } = await req.json()

  if (!quoteId) {
    return NextResponse.json({ error: 'quoteId required' }, { status: 400 })
  }

  if (orderId) {
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId)
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

    const { error: quoteError } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'paid' })
      .eq('id', quoteId)
    if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })

    return NextResponse.json({ success: true, orderId })
  }

  const { data: quote, error: quoteErr } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (quoteErr || !quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 })

  if (quote.status === 'paid' && quote.order_id) {
    return NextResponse.json({ success: true, orderId: quote.order_id })
  }

  const finalStatus = targetStatus || 'paid'

  console.log('[confirm-bank-transfer] inserting order for quote:', quoteId, {
    user_id: quote.user_id,
    total_amount: quote.total_amount,
    payment_method: quote.payment_method,
    finalStatus,
  })

  const { data: newOrder, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: quote.user_id,
      user_email: quote.user_email || '',
      user_name: quote.user_name || '',
      user_phone: quote.user_phone || '',
      user_address: quote.user_address || '',
      total_amount: quote.total_amount ?? 0,
      status: finalStatus,
      payment_method: quote.payment_method || 'bank_transfer',
      memo: `견적 입금 (${quote.product_type || ''})${quote.admin_note ? ' · ' + quote.admin_note : ''}`,
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('[confirm-bank-transfer] order insert failed, updating quote status only:', orderError.message)
    const { error: fallbackErr } = await supabaseAdmin
      .from('quotes')
      .update({ status: finalStatus })
      .eq('id', quoteId)
    if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
    return NextResponse.json({ success: true, fallback: true })
  }

  const { error: quoteError } = await supabaseAdmin
    .from('quotes')
    .update({ status: finalStatus, order_id: newOrder.id })
    .eq('id', quoteId)

  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })

  // 바로 배송완료로 생성된 경우 포인트 적립
  if (finalStatus === 'delivered') {
    try { await awardPointsForDeliveredOrder(supabaseAdmin, newOrder.id) } catch { /* 무시 */ }
  }

  return NextResponse.json({ success: true, orderId: newOrder.id })
}
