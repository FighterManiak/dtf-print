export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 카드: 토스 결제취소(전액/부분) / 무통장: 환불계좌 기록
export async function POST(req: Request) {
  const { orderId, cancelReason, cancelAmount, refundAccount } = await req.json()

  if (!orderId || !cancelReason?.trim()) {
    return NextResponse.json({ error: 'orderId와 취소 사유는 필수입니다.' }, { status: 400 })
  }

  // 주문 조회
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })

  const total = order.total_amount || 0
  const amount = cancelAmount ? Number(cancelAmount) : total
  const isPartial = amount > 0 && amount < total
  const isCard = order.payment_method === 'CARD' || order.payment_method === 'card'

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  let refundNote = ''

  if (isCard) {
    // 카드 결제 → 토스 결제취소 API 호출
    if (!order.payment_key) {
      return NextResponse.json({ error: '결제 키(payment_key)가 없어 자동 취소할 수 없습니다. 토스 대시보드에서 수동 처리해주세요.' }, { status: 400 })
    }
    const body: Record<string, unknown> = { cancelReason: cancelReason.trim() }
    if (isPartial) body.cancelAmount = amount

    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${order.payment_key}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const tossData = await tossRes.json()
    if (!tossRes.ok) {
      return NextResponse.json({ error: `토스 취소 실패: ${tossData.message || tossRes.status}` }, { status: 400 })
    }
    refundNote = isPartial
      ? `[${now}] 카드 부분취소 ${amount.toLocaleString()}원 · ${cancelReason.trim()}`
      : `[${now}] 카드 전액취소 ${amount.toLocaleString()}원 · ${cancelReason.trim()}`
  } else {
    // 무통장입금 → 자동 환불 불가, 환불계좌/사유 기록만
    refundNote = isPartial
      ? `[${now}] 무통장 부분환불 예정 ${amount.toLocaleString()}원 · ${cancelReason.trim()}${refundAccount ? ` · 환불계좌: ${refundAccount}` : ''}`
      : `[${now}] 무통장 전액환불 예정 ${amount.toLocaleString()}원 · ${cancelReason.trim()}${refundAccount ? ` · 환불계좌: ${refundAccount}` : ''}`
  }

  // 상태 업데이트: 전액 → refunded, 부분 → 기존 상태 유지 (메모에만 기록)
  const newStatus = isPartial ? order.status : 'refunded'
  const updatedMemo = order.memo ? `${order.memo}\n${refundNote}` : refundNote

  const { error: updErr } = await supabaseAdmin
    .from('orders')
    .update({ status: newStatus, refund_reason: cancelReason.trim(), memo: updatedMemo })
    .eq('id', orderId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // 연결된 견적도 상태 동기화 (전액 환불 시)
  if (!isPartial) {
    await supabaseAdmin.from('quotes').update({ status: 'refunded' }).eq('order_id', orderId)
  }

  return NextResponse.json({ success: true, partial: isPartial, method: isCard ? 'CARD' : 'BANK', amount })
}
