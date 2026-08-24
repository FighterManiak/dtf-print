import type { SupabaseClient } from '@supabase/supabase-js'

const FROM = 'SUPER HARD <noreply@superhard.co.kr>'
const SITE = 'https://www.superhard.co.kr'
const SUPPORT_EMAIL = 'superhard.int@gmail.com'

type Kind = 'in_progress' | 'shipped'

const CONTENT: Record<Kind, { subject: string; title: string; lead: string }> = {
  in_progress: {
    subject: '[SUPER HARD] 주문하신 상품의 작업이 시작되었습니다',
    title: '작업이 시작되었습니다 🖨️',
    lead: '주문해주신 상품의 출력 작업을 시작했습니다. 작업이 완료되는 대로 빠르게 발송해드리겠습니다.',
  },
  shipped: {
    subject: '[SUPER HARD] 주문하신 상품이 출고되었습니다',
    title: '상품이 출고되었습니다 🚚',
    lead: '주문해주신 상품이 발송되었습니다. 아래 송장번호로 배송 조회가 가능합니다.',
  },
}

function row(label: string, value: string) {
  return `<tr>
    <td style="color:#6b7280;padding:6px 0;width:96px;font-size:13px;">${label}</td>
    <td style="color:#111827;font-weight:600;font-size:13px;">${value}</td>
  </tr>`
}

function buildHtml(kind: Kind, o: {
  userName: string | null
  orderName: string | null
  totalAmount: number | null
  carrier: string | null
  tracking: string | null
  machine: number | null
}) {
  const c = CONTENT[kind]
  const rows = [
    o.orderName ? row('주문명', o.orderName) : '',
    o.totalAmount != null ? row('결제 금액', `${o.totalAmount.toLocaleString()}원`) : '',
    kind === 'in_progress' && o.machine ? row('작업 장비', `${o.machine}번`) : '',
    kind === 'shipped' && o.carrier ? row('택배사', o.carrier) : '',
    kind === 'shipped' && o.tracking ? row('송장번호', o.tracking) : '',
  ].filter(Boolean).join('')

  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <div style="font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px;margin-bottom:4px;">SUPER HARD</div>
    <div style="color:#6b7280;font-size:12px;margin-bottom:24px;">DTF 출력 전문 서비스</div>
    <h1 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 12px;">${c.title}</h1>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 22px;">
      ${o.userName ? `<b>${o.userName}</b>님, ` : ''}${c.lead}
    </p>
    ${rows ? `<table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:12px;padding:8px;margin-bottom:22px;"><tbody>${rows}</tbody></table>` : ''}
    <a href="${SITE}/my-quotes" style="display:block;background:#2563eb;color:white;text-align:center;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;">
      내 주문 현황 보기 →
    </a>
    <p style="color:#9ca3af;font-size:11px;margin-top:22px;line-height:1.6;">
      문의: ${SUPPORT_EMAIL} · 고객센터 010-2560-9749
    </p>
  </div>
</div>`
}

// 주문 상태 변경 알림 메일 (작업 시작 / 출고) — 실패해도 상태변경에는 영향 없음
export async function sendOrderStatusMail(admin: SupabaseClient, orderId: string, kind: Kind): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const { data: order } = await admin
    .from('orders')
    .select('user_email,user_name,order_name,total_amount,carrier,tracking_number,assigned_machine')
    .eq('id', orderId)
    .single()

  const to = order?.user_email
  if (!to) return

  const html = buildHtml(kind, {
    userName: order.user_name,
    orderName: order.order_name,
    totalAmount: order.total_amount,
    carrier: order.carrier,
    tracking: order.tracking_number,
    machine: order.assigned_machine,
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: CONTENT[kind].subject, html }),
  })

  // 발송 통계 기록
  try {
    await admin.from('email_logs').insert({
      type: kind === 'shipped' ? 'shipped' : 'in_progress',
      subject: CONTENT[kind].subject,
      scope: 'single',
      sent_count: 1,
      sent_by: null,
    })
  } catch { /* 무시 */ }
}
