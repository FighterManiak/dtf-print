export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 최고관리자: 주문/견적 내역 삭제 (모든 단계)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { type, id } = await req.json()
  if (!type || !id) return NextResponse.json({ error: 'type, id 필요' }, { status: 400 })

  // 주문 1건 삭제 (order_items 먼저 제거)
  const deleteOrder = async (orderId: string) => {
    await supabaseAdmin.from('order_items').delete().eq('order_id', orderId)
    await supabaseAdmin.from('orders').delete().eq('id', orderId)
  }

  if (type === 'order') {
    await deleteOrder(id)
  } else if (type === 'quote') {
    // 견적에 연결된 주문이 있으면 함께 삭제
    const { data: quote } = await supabaseAdmin.from('quotes').select('order_id').eq('id', id).single()
    if (quote?.order_id) await deleteOrder(quote.order_id as string)
    await supabaseAdmin.from('quotes').delete().eq('id', id)
  } else {
    return NextResponse.json({ error: '잘못된 type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
