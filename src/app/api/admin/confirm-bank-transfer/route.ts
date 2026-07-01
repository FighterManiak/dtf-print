import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, orderId, targetStatus } = await req.json()

  if (!quoteId) {
    return NextResponse.json({ error: 'quoteId required' }, { status: 400 })
  }

  // 이미 order가 있으면 상태만 변경
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

  // order가 없는 경우 (견적 무통장 입금) → 견적 정보 조회 후 order 생성
  const { data: quote, error: quoteErr } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (quoteErr || !quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 })

  // 중복 방지
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
    console.error('[confirm-bank-transfer] order insert error:', orderError)
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  const { error: quoteError } = await supabaseAdmin
    .from('quotes')
    .update({ status: finalStatus, order_id: newOrder.id })
    .eq('id', quoteId)

  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 })

  return NextResponse.json({ success: true, orderId: newOrder.id })
}
