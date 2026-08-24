export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendOrderStatusMail } from '@/lib/order-mail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderId, carrier, tracking_number, notify } = await req.json()

  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  // 기존 송장 확인 (신규 등록/변경 시에만 알림)
  const { data: before } = await supabaseAdmin
    .from('orders')
    .select('status,tracking_number')
    .eq('id', orderId)
    .single()

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ carrier, tracking_number })
    .eq('id', orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 이미 출고 상태인 주문에 송장이 새로 등록/변경되면 송장 안내 메일 발송
  const changed = (tracking_number || '') && before?.tracking_number !== tracking_number
  if (notify !== false && changed && before?.status === 'shipped') {
    try { await sendOrderStatusMail(supabaseAdmin, orderId, 'shipped') } catch { /* 무시 */ }
  }

  return NextResponse.json({ success: true })
}

