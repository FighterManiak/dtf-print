export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { usePoints } from '@/lib/points-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderName, customer, cart, totalAmount, paymentMethod, shippingNote, usedPoints, machineNo } = await req.json()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const { data: newOrder, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: user?.id || null,
      user_name: customer.name,
      user_email: customer.email,
      user_phone: customer.phone,
      user_address: customer.address,
      order_name: orderName || null,
      total_amount: totalAmount,
      used_points: usedPoints || 0,
      machine_no: machineNo || null,
      status: 'pending',
      payment_method: paymentMethod || 'bank_transfer',
      memo: `${paymentMethod === 'CARD' ? '카드결제' : '무통장입금'} 바로주문${orderName ? ` · ${orderName}` : ''}${shippingNote ? ` · ${shippingNote}` : ''}${usedPoints ? ` · 포인트 ${Number(usedPoints).toLocaleString()}P 사용` : ''}`,
    })
    .select('id')
    .single()

  if (orderErr || !newOrder) {
    return NextResponse.json({ error: orderErr?.message || 'order insert failed' }, { status: 500 })
  }

  const items = cart.map((item: {
    productId: string
    quantity: number
    unitPrice: number
    cutting: boolean
    cuttingPrice: number
    requestNote: string
    dueDate: string | null
    filePath?: string | null
    fileName?: string | null
  }) => ({
    order_id: newOrder.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    cutting: item.cutting,
    cutting_price: item.cuttingPrice,
    request_note: item.requestNote || null,
    due_date: item.dueDate || null,
    file_url: item.filePath || null,
    file_name: item.fileName || null,
  }))

  await supabaseAdmin.from('order_items').insert(items)

  // 포인트 사용 차감 (FIFO)
  if (usedPoints && Number(usedPoints) > 0 && user?.id) {
    try { await usePoints(supabaseAdmin, user.id, Number(usedPoints), newOrder.id) } catch { /* 무시 */ }
  }

  return NextResponse.json({ success: true, orderId: newOrder.id })
}
