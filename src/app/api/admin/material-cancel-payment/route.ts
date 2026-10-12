export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAdminUser, adminOnly } from '@/lib/admin-auth'
import { refundUsedPoints } from '@/lib/points-server'

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_sk_jZ61JOxRQVEoxkmy4AQ8W0X9bAqw'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 자재 주문 결제 취소
// 카드: 토스 결제취소(전액/부분) / 무통장: 입금된 주문은 환불계좌 기록, 미입금은 바로 취소
// 전액 취소 시 상태 '취소' + 사용 포인트 환원 + (선택) 재고 복구
export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return adminOnly()

  const { id, cancelReason, cancelAmount, refundAccount, restock } = await req.json()
  const reason = String(cancelReason || '').trim().slice(0, 300)
  if (!id || !reason) {
    return NextResponse.json({ error: '주문과 취소 사유는 필수입니다.' }, { status: 400 })
  }

  const { data: order } = await supabaseAdmin.from('material_orders').select('*').eq('id', id).single()
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })

  const total = Number(order.total_amount) || 0
  const amount = cancelAmount ? Math.round(Number(cancelAmount)) : total
  if (!Number.isFinite(amount) || amount <= 0 || amount > total) {
    return NextResponse.json({ error: `취소 금액은 1원 ~ ${total.toLocaleString()}원 사이여야 합니다.` }, { status: 400 })
  }
  let isPartial = amount < total
  const isCard = order.payment_method === 'CARD'
  const wasCancelled = order.status === 'cancelled'

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const by = admin.email ? ` · 처리 ${admin.email}` : ''
  let note = ''

  if (isCard) {
    if (!order.payment_key) {
      return NextResponse.json({ error: '결제 키가 없어 자동 취소할 수 없습니다. (결제창을 거치지 않은 주문) 토스 대시보드에서 확인해주세요.' }, { status: 400 })
    }
    const body: Record<string, unknown> = { cancelReason: reason }
    if (isPartial) body.cancelAmount = amount

    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const tossData = await tossRes.json().catch(() => ({}))
    if (!tossRes.ok) {
      return NextResponse.json({ error: `토스 취소 실패: ${tossData.message || tossRes.status}` }, { status: 400 })
    }
    // 부분취소가 쌓여 남은 결제금액이 0이 되면 전액 취소로 처리
    if (isPartial && Number(tossData.balanceAmount) === 0) isPartial = false
    note = `[${now}] 카드 ${isPartial ? '부분' : '전액'}취소 ${amount.toLocaleString()}원 · ${reason}${by}`
  } else if (order.is_paid === false || order.status === 'pending') {
    // 입금 전 주문 — 돌려줄 돈이 없으므로 전액 취소만
    isPartial = false
    note = `[${now}] 입금 전 주문 취소 · ${reason}${by}`
  } else {
    const acct = String(refundAccount || '').trim().slice(0, 100)
    note = `[${now}] 무통장 ${isPartial ? '부분' : '전액'}환불 예정 ${amount.toLocaleString()}원 · ${reason}${acct ? ` · 환불계좌: ${acct}` : ''}${by}`
  }

  const update: Record<string, unknown> = { memo: order.memo ? `${order.memo}\n${note}` : note }
  if (!isPartial) update.status = 'cancelled'
  const { error: updErr } = await supabaseAdmin.from('material_orders').update(update).eq('id', id)
  if (updErr) {
    // 카드 취소는 이미 끝났으므로 기록 실패를 알려 수동 메모를 남기게 함
    return NextResponse.json({ error: `취소는 처리됐지만 기록 저장에 실패했습니다: ${updErr.message}` }, { status: 500 })
  }

  let restocked = 0
  if (!isPartial) {
    // 사용했던 포인트 환원 (이미 환원된 건은 건너뜀)
    try { await refundUsedPoints(supabaseAdmin, String(id)) } catch { /* 무시 */ }

    // 재고 복구 — 이미 취소 상태였던 주문은 재고가 복구됐을 수 있어 건너뜀
    if (restock && !wasCancelled) {
      const items = Array.isArray(order.items) ? order.items as { materialId: string; qty: number }[] : []
      for (const it of items) {
        if (!it?.materialId) continue
        const { data: m } = await supabaseAdmin.from('materials').select('stock').eq('id', it.materialId).maybeSingle()
        if (m && m.stock != null) {
          await supabaseAdmin.from('materials').update({ stock: (Number(m.stock) || 0) + (Number(it.qty) || 0) }).eq('id', it.materialId)
          restocked++
        }
      }
    }
  }

  return NextResponse.json({ success: true, partial: isPartial, method: isCard ? 'CARD' : 'BANK', amount, restocked })
}
