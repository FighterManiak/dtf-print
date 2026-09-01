export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revokePointsForOrder } from '@/lib/points-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자/최고관리자: 주문·견적 내역 삭제 (모든 단계) — 삭제 이력은 감사 로그에 보존
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { type, id, reason } = await req.json()
  if (!type || !id) return NextResponse.json({ error: 'type, id 필요' }, { status: 400 })

  // 감사 로그 기록 (삭제 전 원본 스냅샷 보존)
  const log = async (payload: {
    kind: string
    recordId: string
    userName: string | null
    userPhone: string | null
    userEmail: string | null
    amount: number | null
    status: string | null
    isPaid: boolean | null
    orderName: string | null
    memo: string | null
    createdAt: string | null
    snapshot: unknown
  }) => {
    try {
      await supabaseAdmin.from('deleted_orders').insert({
        kind: payload.kind,
        record_id: payload.recordId,
        user_name: payload.userName,
        user_phone: payload.userPhone,
        user_email: payload.userEmail,
        total_amount: payload.amount,
        status: payload.status,
        is_paid: payload.isPaid,
        order_name: payload.orderName,
        memo: payload.memo,
        original_created_at: payload.createdAt,
        snapshot: payload.snapshot,
        deleted_by: user?.email || null,
        deleted_by_role: role,
        reason: (reason || '').trim() || null,
      })
    } catch { /* 로그 실패해도 삭제는 진행 */ }
  }

  const deleteOrder = async (orderId: string, alsoLog: boolean) => {
    const { data: order } = await supabaseAdmin.from('orders').select('*,order_items(*)').eq('id', orderId).single()
    if (order && alsoLog) {
      await log({
        kind: 'order',
        recordId: orderId,
        userName: order.user_name, userPhone: order.user_phone, userEmail: order.user_email,
        amount: order.total_amount, status: order.status, isPaid: order.is_paid ?? null,
        orderName: order.order_name, memo: order.memo, createdAt: order.created_at,
        snapshot: order,
      })
    }
    // 주문 삭제 전 해당 주문으로 적립된 포인트 환수 (고아 포인트 방지)
    try { await revokePointsForOrder(supabaseAdmin, orderId) } catch { /* 무시 */ }
    // 남은 포인트 기록의 주문 연결 해제 (주문 삭제 후 참조 방지)
    try { await supabaseAdmin.from('points').update({ order_id: null }).eq('order_id', orderId) } catch { /* 무시 */ }

    await supabaseAdmin.from('order_items').delete().eq('order_id', orderId)
    await supabaseAdmin.from('orders').delete().eq('id', orderId)
    return order
  }

  if (type === 'order') {
    await deleteOrder(id, true)
  } else if (type === 'quote') {
    const { data: quote } = await supabaseAdmin.from('quotes').select('*').eq('id', id).single()
    let linkedOrder: Record<string, unknown> | null = null
    if (quote?.order_id) linkedOrder = (await deleteOrder(quote.order_id as string, false)) as Record<string, unknown> | null
    if (quote) {
      const ord = linkedOrder as { total_amount?: number; status?: string; is_paid?: boolean } | null
      await log({
        kind: 'quote',
        recordId: id,
        userName: quote.user_name, userPhone: quote.user_phone, userEmail: quote.user_email,
        amount: ord?.total_amount ?? quote.total_amount, status: ord?.status ?? quote.status,
        isPaid: ord?.is_paid ?? null,
        orderName: quote.order_name, memo: quote.admin_note, createdAt: quote.created_at,
        snapshot: { quote, order: linkedOrder },
      })
    }
    await supabaseAdmin.from('quotes').delete().eq('id', id)
  } else {
    return NextResponse.json({ error: '잘못된 type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
