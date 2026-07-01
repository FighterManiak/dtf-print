import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderId, status, refund_reason } = await req.json()

  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }
  if (refund_reason !== undefined) updateData.refund_reason = refund_reason

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: `orders 테이블에 해당 ID 없음: ${orderId}` }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
