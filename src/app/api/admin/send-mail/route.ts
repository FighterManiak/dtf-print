export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM = 'SUPER HARD <noreply@superhard.co.kr>'
const SUPPORT_EMAIL = 'superhard.int@gmail.com'

// 본문(줄바꿈 텍스트)을 브랜드 HTML 템플릿으로 감싸기
function wrapHtml(subject: string, bodyHtml: string): string {
  return `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
    <div style="font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px; margin-bottom: 4px;">SUPER HARD</div>
    <div style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">DTF 출력 전문 서비스</div>
    <h1 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 16px;">${subject}</h1>
    <div style="color: #374151; font-size: 14px; line-height: 1.7;">${bodyHtml}</div>
  </div>
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px; line-height: 1.6;">
    본 메일은 SUPER HARD 회원에게 발송되었습니다.<br />
    수신을 원치 않으시면 ${SUPPORT_EMAIL} 로 회신해주세요.
  </p>
</div>`
}

// 회원 이메일 목록 조회 (대상별)
async function getRecipients(scope: string, testEmail: string | null): Promise<string[]> {
  if (scope === 'test' && testEmail) return [testEmail]

  const emails: string[] = []
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    for (const u of users) {
      if (!u.email) continue
      const meta = u.user_metadata || {}
      if (meta.withdrawn) continue // 탈퇴 회원 제외
      if (!u.email_confirmed_at) continue // 미인증 제외
      if (scope === 'verified' && meta.verify_status !== 'approved' && meta.role !== 'dtf_verified') continue
      emails.push(u.email)
    }
    if (users.length < perPage) break
  }
  return [...new Set(emails)]
}

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.' }, { status: 500 })
  }

  const { subject, body, scope } = await req.json()
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
  }

  const recipients = await getRecipients(scope || 'all', user?.email || null)
  if (recipients.length === 0) {
    return NextResponse.json({ error: '발송 대상이 없습니다.' }, { status: 400 })
  }

  const bodyHtml = body.replace(/\n/g, '<br />')
  const html = wrapHtml(subject, bodyHtml)

  // Resend 배치 발송 (한 번에 최대 100건) — 각 수신자에게 개별 발송(BCC 노출 방지)
  let sent = 0
  const failed: string[] = []
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payload = chunk.map((to) => ({ from: FROM, to: [to], subject, html }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        sent += chunk.length
      } else {
        const err = await res.json().catch(() => ({}))
        // 배치 실패 시 전체 chunk를 실패로 기록하고 에러 메시지 전달
        return NextResponse.json({
          error: `발송 중 오류 (${res.status}): ${err.message || err.error?.message || '알 수 없는 오류'}`,
          sent,
          total: recipients.length,
        }, { status: 500 })
      }
    } catch (e) {
      failed.push(...chunk)
      return NextResponse.json({
        error: `발송 실패: ${e instanceof Error ? e.message : '네트워크 오류'}`,
        sent,
        total: recipients.length,
      }, { status: 500 })
    }
  }

  // 발송 로그 기록 (통계용) — 실패해도 발송 결과에는 영향 없음
  try {
    await supabaseAdmin.from('email_logs').insert({
      type: scope === 'test' ? 'test' : 'broadcast',
      subject,
      scope: scope || 'all',
      sent_count: sent,
      sent_by: user?.email || null,
    })
  } catch { /* 무시 */ }

  return NextResponse.json({ ok: true, sent, total: recipients.length, failed: failed.length })
}

// 대상별 예상 수신 인원 미리보기
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const url = new URL(req.url)
  const scope = url.searchParams.get('scope') || 'all'
  const recipients = await getRecipients(scope, user?.email || null)
  return NextResponse.json({ count: recipients.length })
}
