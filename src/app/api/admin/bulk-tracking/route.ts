export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendOrderStatusMail } from '@/lib/order-mail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 송장 일괄 등록: rows = [{ orderId, carrier, tracking_number }]
// 등록 시 상태를 '출고(shipped)'로 변경
export async function POST(req: Request) {
  const { rows, notify } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '등록할 데이터가 없습니다.' }, { status: 400 })
  }

  let ok = 0
  const failed: string[] = []
  for (const r of rows) {
    const orderId = String(r.orderId || '').trim()
    const tracking = String(r.tracking_number || '').trim()
    const carrier = String(r.carrier || '').trim()
    if (!orderId || !tracking) { continue }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ carrier, tracking_number: tracking, status: 'shipped' })
      .eq('id', orderId)
      .select('id')

    if (error || !data || data.length === 0) { failed.push(orderId); continue }
    ok++
    // 송장번호가 포함된 출고 알림 메일 발송 (실패해도 등록에는 영향 없음)
    if (notify !== false) {
      try { await sendOrderStatusMail(supabaseAdmin, orderId, 'shipped') } catch { /* 무시 */ }
    }
  }

  return NextResponse.json({ success: true, updated: ok, failed })
}
