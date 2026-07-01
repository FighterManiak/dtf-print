export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId } = await req.json()
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

  // orders ?뚯씠釉붿뿉 二쇰Ц ?앹꽦
  const { data: newOrder, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: quote.user_id,
      user_email: quote.user_email,
      user_name: quote.user_name,
      user_phone: quote.user_phone,
      user_address: quote.user_address,
      total_amount: quote.total_amount,
      status: 'paid',
      memo: `寃ъ쟻 二쇰Ц (${quote.product_type})${quote.admin_note ? ' 쨌 ' + quote.admin_note : ''}`,
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

  return NextResponse.json({ success: true, orderId: newOrder.id })
}

