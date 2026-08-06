export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자 직접 주문 등록 (전화/오프라인 주문)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const b = await req.json()
  const name = (b.name || '').trim()
  const amount = Math.round(Number(b.amount) || 0)
  if (!name) return NextResponse.json({ error: '주문자 이름을 입력해주세요.' }, { status: 400 })
  if (amount <= 0) return NextResponse.json({ error: '금액을 입력해주세요.' }, { status: 400 })

  const status = ['pending', 'paid', 'in_progress'].includes(b.status) ? b.status : 'pending'
  const paymentMethod = b.paymentMethod || 'bank_transfer'
  const address = b.deliveryMethod === 'pickup' ? '직접 수령' : (b.address || '').trim()

  const contentLine = (b.content || '').trim()
  const memo = `📞 전화주문${contentLine ? ` · ${contentLine}` : ''}${b.memo ? ` · ${b.memo}` : ''}`

  const { data: newOrder, error } = await supabaseAdmin.from('orders').insert({
    user_id: null,
    user_name: name,
    user_email: (b.email || '').trim() || null,
    user_phone: (b.phone || '').trim() || null,
    user_address: address || null,
    order_name: (b.orderName || '').trim() || null,
    total_amount: amount,
    status,
    payment_method: paymentMethod,
    memo,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, orderId: newOrder.id })
}
