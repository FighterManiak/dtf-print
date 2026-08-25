export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BulkRow {
  name?: string
  phone?: string
  email?: string
  orderName?: string
  content?: string
  amount?: number | string
  paymentMethod?: string
  deliveryMethod?: string
  address?: string
  status?: string
  paymentStatus?: string
  depositDue?: string
  memo?: string
}

const VALID_STATUS = ['pending', 'paid', 'in_progress', 'shipped', 'delivered']

// 관리자: 전화주문 대량 등록 (엑셀 업로드)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { rows } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '등록할 주문이 없습니다.' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: '한 번에 최대 500건까지 등록할 수 있습니다.' }, { status: 400 })
  }

  const inserts: Record<string, unknown>[] = []
  const errors: string[] = []

  ;(rows as BulkRow[]).forEach((r, i) => {
    const line = i + 2 // 엑셀 행 번호(헤더 제외)
    const name = String(r.name ?? '').trim()
    const amount = Math.round(Number(r.amount) || 0)

    if (!name) { errors.push(`${line}행: 주문자 이름 없음`); return }
    // 금액 0원 허용 (무료 샘플 등) — 음수만 차단
    if (!Number.isFinite(amount) || amount < 0) { errors.push(`${line}행: 금액이 올바르지 않음`); return }

    const status = VALID_STATUS.includes(String(r.status || '')) ? String(r.status) : 'pending'
    const isPaid = String(r.paymentStatus || '') === 'unpaid' ? false : true
    const isPickup = String(r.deliveryMethod || '') === 'pickup'
    const address = isPickup ? '직접 수령' : String(r.address ?? '').trim()
    const content = String(r.content ?? '').trim()
    const due = String(r.depositDue ?? '').trim()
    const extraMemo = String(r.memo ?? '').trim()

    inserts.push({
      user_id: null,
      user_name: name,
      user_email: String(r.email ?? '').trim() || null,
      user_phone: String(r.phone ?? '').trim() || null,
      user_address: address || null,
      order_name: String(r.orderName ?? '').trim() || null,
      total_amount: amount,
      status,
      is_paid: isPaid,
      payment_method: String(r.paymentMethod || '') === 'CARD' ? 'CARD' : 'bank_transfer',
      memo: `📞 전화주문${due && status === 'pending' ? ` · 입금예정 ${due}` : ''}${content ? ` · ${content}` : ''}${extraMemo ? ` · ${extraMemo}` : ''}`,
    })
  })

  if (inserts.length === 0) {
    return NextResponse.json({ error: '등록 가능한 행이 없습니다.', errors }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('orders').insert(inserts)
  if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })

  return NextResponse.json({ success: true, created: inserts.length, skipped: errors.length, errors })
}
