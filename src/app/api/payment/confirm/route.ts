import { NextRequest, NextResponse } from 'next/server'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, orderName } = await req.json()
  void orderName // 향후 orders 저장 시 활용

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

  return NextResponse.json({ success: true, data })
}
