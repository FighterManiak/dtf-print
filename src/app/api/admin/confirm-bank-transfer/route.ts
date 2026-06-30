import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, orderId } = await req.json()

  if (!quoteId) {
    return NextResponse.json({ error: 'quoteId required' }, { status: 400 })
  }

  // quotes 상태 paid로 변경
  const { error: quoteError } = await supabaseAdmin
    .from('quotes')
    .update({ status: 'paid' })
    .eq('id', quoteId)

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  // 연결된 order도 paid로 변경
  if (orderId) {
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId)

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
