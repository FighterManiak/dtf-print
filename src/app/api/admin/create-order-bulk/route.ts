export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BulkItem { productId: string; quantity: number; unitPrice?: number }

interface BulkRow {
  items?: BulkItem[]
  name?: string
  phone?: string
  email?: string
  orderName?: string
  company?: string
  depositorName?: string
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
  const itemsPerRow: BulkItem[][] = []
  const errors: string[] = []

  ;(rows as BulkRow[]).forEach((r, i) => {
    const line = i + 2 // 엑셀 행 번호(헤더 제외)
    const name = String(r.name ?? '').trim()
    const amount = Math.round(Number(r.amount) || 0)

    if (!name) { errors.push(`${line}행: 주문자 이름 없음`); return }
    // 주문내용은 엑셀 '상품/상세'로 나가는 항목이라 필수 (주문명으로 대체 가능)
    if (!String(r.content ?? '').trim() && !String(r.orderName ?? '').trim()) {
      errors.push(`${line}행: 주문내용(또는 주문명) 없음`); return
    }
    // 금액 0원 허용 (무료 샘플 등) — 음수만 차단
    if (!Number.isFinite(amount) || amount < 0) { errors.push(`${line}행: 금액이 올바르지 않음`); return }

    const status = VALID_STATUS.includes(String(r.status || '')) ? String(r.status) : 'pending'
    const isPaid = String(r.paymentStatus || '') === 'unpaid' ? false : true
    const isPickup = String(r.deliveryMethod || '') === 'pickup'
    const address = isPickup ? '직접 수령' : String(r.address ?? '').trim()
    const content = String(r.content ?? '').trim()
    const due = String(r.depositDue ?? '').trim()
    const extraMemo = String(r.memo ?? '').trim()
    const company = String(r.company ?? '').trim()
    const pm = String(r.paymentMethod || '') === 'CARD' ? 'CARD' : 'bank_transfer'
    // 무통장은 입금자명 기록 (비어 있으면 업체명 → 주문자명)
    const depositor = pm === 'bank_transfer'
      ? (String(r.depositorName ?? '').trim() || company || name)
      : null

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
      payment_method: pm,
      depositor_name: depositor,
      memo: `📞 전화주문${company ? ` · [업체] ${company}` : ''}${due && status === 'pending' ? ` · 입금예정 ${due}` : ''}${content ? ` · ${content}` : ''}${extraMemo ? ` · ${extraMemo}` : ''}`,
    })
    // 주문과 같은 순서로 품목을 보관 (insert 후 order_id 연결)
    itemsPerRow.push(Array.isArray(r.items) ? r.items : [])
  })

  if (inserts.length === 0) {
    return NextResponse.json({ error: '등록 가능한 행이 없습니다.', errors }, { status: 400 })
  }

  let { data: created, error } = await supabaseAdmin.from('orders').insert(inserts).select('id')
  // depositor_name 컬럼이 아직 없으면 해당 필드를 빼고 다시 저장
  if (error && String(error.message || '').includes('depositor_name')) {
    const stripped = inserts.map((row) => { const c = { ...row }; delete c.depositor_name; return c })
    ;({ data: created, error } = await supabaseAdmin.from('orders').insert(stripped).select('id'))
  }
  if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })

  // 품목 저장 — 입력 순서대로 생성된 주문에 연결
  const itemRows: Record<string, unknown>[] = []
  ;(created || []).forEach((o, i) => {
    (itemsPerRow[i] || []).forEach((it) => {
      if (!it?.productId || !(Number(it.quantity) > 0)) return
      itemRows.push({
        order_id: o.id,
        product_id: String(it.productId),
        quantity: Number(it.quantity),
        unit_price: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
        cutting: false,
        cutting_price: 0,
      })
    })
  })
  if (itemRows.length > 0) {
    // 품목 저장 실패해도 주문 등록은 유지
    try { await supabaseAdmin.from('order_items').insert(itemRows) } catch { /* 무시 */ }
  }

  return NextResponse.json({
    success: true, created: inserts.length, skipped: errors.length, errors,
    items: itemRows.length,
  })
}
