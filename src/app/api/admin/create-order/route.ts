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
  // 금액 0원 허용 (무료 샘플 등) — 음수만 차단
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: '금액이 올바르지 않습니다.' }, { status: 400 })

  const status = ['pending', 'paid', 'in_progress', 'shipped', 'delivered'].includes(b.status) ? b.status : 'pending'
  const paymentMethod = b.paymentMethod || 'bank_transfer'
  // 입금 여부: 후불(미입금)=false, 입금완료=true
  const isPaid = b.paymentStatus === 'unpaid' ? false : true
  const address = b.deliveryMethod === 'pickup' ? '직접 수령' : (b.address || '').trim()

  const contentLine = (b.content || '').trim()
  const dueLine = (b.depositDue || '').trim()
  const isSample = !!b.isSample
  const company = (b.company || '').trim()
  // 업체명은 메모 앞부분에 남겨 다음 주문 시 자동완성에 활용
  const head = `${isSample ? '🎁 샘플주문 (무료)' : '📞 전화주문'}${company ? ` · ${company}` : ''}`
  const memo = `${head}${!isSample && dueLine && status === 'pending' ? ` · 입금예정 ${dueLine}` : ''}${contentLine ? ` · ${contentLine}` : ''}${b.memo ? ` · ${b.memo}` : ''}`

  const { data: newOrder, error } = await supabaseAdmin.from('orders').insert({
    // 회원과 연결된 경우 user_id를 넣어 포인트·등급이 정상 반영되게 함
    user_id: (b.userId || '').trim() || null,
    user_name: name,
    user_email: (b.email || '').trim() || null,
    user_phone: (b.phone || '').trim() || null,
    user_address: address || null,
    order_name: (b.orderName || '').trim() || null,
    total_amount: amount,
    status,
    is_paid: isPaid,
    payment_method: paymentMethod,
    memo,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, orderId: newOrder.id })
}
