export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getShippingFee } from '@/lib/shipping'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, delivery } = await req.json()
  if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

  const { data: quote } = await supabaseAdmin.from('quotes').select('*').eq('id', quoteId).single()
  if (!quote) return NextResponse.json({ error: 'quote not found' }, { status: 404 })

  // 배송비 계산 — 직접수령 0원, 택배는 지역 추가배송비 포함
  const product = Number(quote.total_amount) || 0
  const isPickup = delivery?.method === 'pickup'
  const shipTotal = isPickup ? 0 : getShippingFee(product, delivery?.zonecode || '').total
  const payTotal = product + shipTotal
  const fullAddress = isPickup
    ? '직접 수령'
    : `${delivery?.zonecode ? `(${delivery.zonecode}) ` : ''}${delivery?.address || quote.user_address || ''}${delivery?.addressDetail ? ` ${delivery.addressDetail}` : ''}`.trim()
  const shipLabel = isPickup ? '직접 수령 (배송비 없음)' : `배송비 ${shipTotal.toLocaleString()}원`

  const { data: newOrder, error: orderErr } = await supabaseAdmin.from('orders').insert({
    user_id: quote.user_id,
    user_email: quote.user_email,
    user_name: quote.user_name,
    user_phone: quote.user_phone,
    user_address: fullAddress || quote.user_address,
    total_amount: payTotal,
    status: 'pending',
    memo: `무통장입금 견적주문 (${quote.product_type})${quote.admin_note ? ' · ' + quote.admin_note : ''} · ${shipLabel}`,
  }).select('id').single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  await supabaseAdmin.from('quotes').update({
    status: 'bank_transfer_pending',
    order_id: newOrder.id,
  }).eq('id', quoteId)

  return NextResponse.json({ success: true })
}

