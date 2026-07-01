export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, orderName, dbOrderId } = await req.json()
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

  // DB order瑜?paid濡??낅뜲?댄듃 (移대뱶 寃곗젣 ?깃났)
  if (dbOrderId) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', payment_method: 'CARD', payment_key: paymentKey })
      .eq('id', dbOrderId)
  }

  return NextResponse.json({ success: true, data })
}

