export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { awardPointsForDeliveredOrder, awardReferralIfFirstDelivery, awardReferralCommission, revokePointsForOrder } from '@/lib/points-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orderId, status, refund_reason, assignedMachine } = await req.json()

  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }
  if (refund_reason !== undefined) updateData.refund_reason = refund_reason
  // 작업 시작 시 실제 사용 장비 지정
  if (assignedMachine !== undefined) updateData.assigned_machine = assignedMachine || null

  // 장비 지정 시 진행 관리 내역에 자동 기록 — 고객 요청값과 실제 배정값을 함께 남김
  let historyEntry: string | null = null
  if (assignedMachine) {
    const { data: cur } = await supabaseAdmin
      .from('orders')
      .select('memo, machine_no')
      .eq('id', orderId)
      .single()
    // 연결된 견적이 있으면 견적의 machine_no를 우선 (견적 주문은 요청값이 quotes에 있음)
    const { data: linkedQuote } = await supabaseAdmin
      .from('quotes')
      .select('id, admin_note, machine_no')
      .eq('order_id', orderId)
      .maybeSingle()

    const requested = linkedQuote?.machine_no ?? cur?.machine_no
    const now = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const requestedLabel = requested ? `고객 요청 ${requested}번` : '고객 요청: 자동 배정'
    historyEntry = `[${now}] 작업 시작 · ${requestedLabel} → 실제 작업 장비 ${assignedMachine}번`

    if (linkedQuote?.id) {
      // 견적 주문: 진행 내역이 quotes.admin_note에 표시됨
      await supabaseAdmin
        .from('quotes')
        .update({ admin_note: linkedQuote.admin_note ? `${linkedQuote.admin_note}\n${historyEntry}` : historyEntry })
        .eq('id', linkedQuote.id)
    } else {
      // 바로주문: orders.memo에 기록
      updateData.memo = cur?.memo ? `${cur.memo}\n${historyEntry}` : historyEntry
    }
  }

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

  // 배송 완료 시 등급별 포인트 적립 + 추천인 보상 + 추천 커미션 (중복 방지)
  if (status === 'delivered') {
    try {
      await awardPointsForDeliveredOrder(supabaseAdmin, orderId)
      await awardReferralCommission(supabaseAdmin, orderId)
      const { data: o } = await supabaseAdmin.from('orders').select('user_id').eq('id', orderId).single()
      if (o?.user_id) await awardReferralIfFirstDelivery(supabaseAdmin, o.user_id)
    } catch { /* 적립 실패는 상태변경에 영향 없음 */ }
  }

  // 취소/환불 시 해당 주문으로 적립된 포인트 자동 환수
  if (status === 'cancelled' || status === 'refunded') {
    try { await revokePointsForOrder(supabaseAdmin, orderId) } catch { /* 무시 */ }
  }

  return NextResponse.json({ success: true })
}
