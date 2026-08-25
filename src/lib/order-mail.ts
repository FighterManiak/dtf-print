import type { SupabaseClient } from '@supabase/supabase-js'
import { trackingUrl } from './tracking'

const FROM = 'SUPER HARD <noreply@superhard.co.kr>'
const SITE = 'https://www.superhard.co.kr'
const SUPPORT_EMAIL = 'superhard.int@gmail.com'
const SUPPORT_TEL = '010-2560-9749'

// 관리자 알림 수신 주소 (환경변수로 지정 가능, 없으면 기본값)
const ADMIN_NOTIFY_TO = (process.env.ADMIN_NOTIFY_EMAIL || SUPPORT_EMAIL)
  .split(',').map((s) => s.trim()).filter(Boolean)

const BANK = { bank: '기업은행', account: '495-028223-01-021', holder: '아유디스터디 (조봉준)' }

export type Kind = 'ordered' | 'payment_confirmed' | 'in_progress' | 'shipped'

const CONTENT: Record<Kind, { subject: string; title: string; lead: string }> = {
  ordered: {
    subject: '[SUPER HARD] 주문이 정상 접수되었습니다',
    title: '주문이 접수되었습니다 ✅',
    lead: '주문해주셔서 감사합니다. 아래 내용으로 주문이 접수되었습니다.',
  },
  payment_confirmed: {
    subject: '[SUPER HARD] 입금이 확인되었습니다',
    title: '입금이 확인되었습니다 💳',
    lead: '입금이 정상적으로 확인되었습니다. 곧 출력 작업을 시작하겠습니다.',
  },
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

interface OrderInfo {
  userName: string | null
  orderName: string | null
  totalAmount: number | null
  carrier: string | null
  tracking: string | null
  machine: number | null
  paymentMethod: string | null
  status: string | null
  address: string | null
  memo: string | null
}

function buildHtml(kind: Kind, o: OrderInfo) {
  const c = CONTENT[kind]
  const isBank = o.paymentMethod === 'bank_transfer'
  const track = trackingUrl(o.carrier, o.tracking)

  const rows = [
    o.orderName ? row('주문명', o.orderName) : '',
    o.totalAmount != null ? row(kind === 'ordered' && isBank ? '입금 금액' : '결제 금액', `${o.totalAmount.toLocaleString()}원`) : '',
    kind === 'in_progress' && o.machine ? row('작업 장비', `${o.machine}번`) : '',
    kind === 'shipped' && o.carrier ? row('택배사', o.carrier) : '',
    kind === 'shipped' && o.tracking ? row('송장번호', o.tracking) : '',
  ].filter(Boolean).join('')

  // 무통장 주문 접수 시 계좌 안내
  const bankBox = (kind === 'ordered' && isBank) ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:22px;">
      <p style="color:#c2410c;font-size:13px;font-weight:700;margin:0 0 8px;">🏦 입금 계좌 안내</p>
      <p style="color:#374151;font-size:13px;margin:0;line-height:1.8;">
        ${BANK.bank} <b>${BANK.account}</b><br />
        예금주: ${BANK.holder}<br />
        <span style="color:#c2410c;">입금이 확인되면 작업을 시작합니다.</span>
      </p>
    </div>` : ''

  // 출고 시 배송조회 버튼
  const trackBtn = (kind === 'shipped' && track) ? `
    <a href="${track}" style="display:block;background:#7c3aed;color:white;text-align:center;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:10px;">
      🚚 배송 조회하기 →
    </a>` : ''

  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <div style="font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px;margin-bottom:4px;">SUPER HARD</div>
    <div style="color:#6b7280;font-size:12px;margin-bottom:24px;">DTF 출력 전문 서비스</div>
    <h1 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 12px;">${c.title}</h1>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 22px;">
      ${o.userName ? `<b>${o.userName}</b>님, ` : ''}${c.lead}
    </p>
    ${rows ? `<table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:12px;padding:8px;margin-bottom:22px;"><tbody>${rows}</tbody></table>` : ''}
    ${bankBox}
    ${trackBtn}
    <a href="${SITE}/my-quotes" style="display:block;background:${kind === 'shipped' && track ? '#f3f4f6' : '#2563eb'};color:${kind === 'shipped' && track ? '#374151' : 'white'};text-align:center;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;">
      내 주문 현황 보기 →
    </a>
    <p style="color:#9ca3af;font-size:11px;margin-top:22px;line-height:1.6;">
      문의: ${SUPPORT_EMAIL} · 고객센터 ${SUPPORT_TEL}
    </p>
  </div>
</div>`
}

async function sendMail(admin: SupabaseClient, to: string[], subject: string, html: string, logType: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || to.length === 0) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  try {
    await admin.from('email_logs').insert({
      type: logType, subject, scope: 'single', sent_count: to.length, sent_by: null,
    })
  } catch { /* 무시 */ }
}

async function loadOrder(admin: SupabaseClient, orderId: string) {
  const { data } = await admin
    .from('orders')
    .select('user_email,user_name,user_phone,user_address,order_name,total_amount,carrier,tracking_number,assigned_machine,payment_method,status,memo')
    .eq('id', orderId)
    .single()
  return data
}

// 고객 주문 상태 알림 메일 — 실패해도 주문 처리에는 영향 없음
export async function sendOrderStatusMail(admin: SupabaseClient, orderId: string, kind: Kind): Promise<void> {
  const order = await loadOrder(admin, orderId)
  const to = order?.user_email
  if (!to) return

  const html = buildHtml(kind, {
    userName: order.user_name,
    orderName: order.order_name,
    totalAmount: order.total_amount,
    carrier: order.carrier,
    tracking: order.tracking_number,
    machine: order.assigned_machine,
    paymentMethod: order.payment_method,
    status: order.status,
    address: order.user_address,
    memo: order.memo,
  })

  await sendMail(admin, [to], CONTENT[kind].subject, html, kind)
}

// 관리자 신규 주문 알림 — 주문 놓침 방지
export async function sendAdminNewOrderMail(admin: SupabaseClient, orderId: string): Promise<void> {
  const o = await loadOrder(admin, orderId)
  if (!o) return

  const isBank = o.payment_method === 'bank_transfer'
  const payLabel = isBank ? '무통장입금 (입금대기)' : '카드결제 (결제완료)'
  const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16)

  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:16px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-top:4px solid #2563eb;">
    <h1 style="font-size:19px;font-weight:800;color:#111827;margin:0 0 4px;">🔔 새 주문이 접수되었습니다</h1>
    <p style="color:#6b7280;font-size:12px;margin:0 0 20px;">${now} (KST)</p>
    <table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:12px;margin-bottom:20px;"><tbody>
      ${row('주문자', `${o.user_name || '—'}${o.user_phone ? ` (${o.user_phone})` : ''}`)}
      ${o.order_name ? row('주문명', o.order_name) : ''}
      ${row('금액', `${(o.total_amount || 0).toLocaleString()}원`)}
      ${row('결제', payLabel)}
      ${o.user_address ? row('배송지', o.user_address) : ''}
      ${o.user_email ? row('이메일', o.user_email) : ''}
    </tbody></table>
    ${o.memo ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:20px;">
      <p style="color:#dc2626;font-size:12px;font-weight:700;margin:0 0 4px;">📌 요청사항 / 메모</p>
      <p style="color:#374151;font-size:13px;margin:0;white-space:pre-wrap;">${o.memo}</p>
    </div>` : ''}
    <a href="${SITE}/admin/quotes" style="display:block;background:#2563eb;color:white;text-align:center;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;">
      주문 관리로 이동 →
    </a>
  </div>
</div>`

  await sendMail(admin, ADMIN_NOTIFY_TO, `[신규주문] ${o.user_name || '고객'} · ${(o.total_amount || 0).toLocaleString()}원`, html, 'admin_new_order')
}
