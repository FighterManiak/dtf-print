export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM = 'SUPER HARD <noreply@superhard.co.kr>'
const SITE = 'https://www.superhard.co.kr'
const SUPPORT_EMAIL = 'superhard.int@gmail.com'

// 헷갈리는 문자(0,O,1,l,I) 제외한 임시 비밀번호 생성
function genTempPassword(len = 10): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digit = '23456789'
  const all = upper + lower + digit
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  // 대문자·소문자·숫자 각 1개 이상 보장
  const chars = [pick(upper), pick(lower), pick(digit), pick(digit)]
  while (chars.length < len) chars.push(pick(all))
  // 셔플
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// 관리자: 회원 임시 비밀번호 발급
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { userId, sendEmail } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId)
  const t = target?.user
  if (!t) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 })

  // 관리자 계정은 최고관리자만 초기화 가능
  const targetRole = t.user_metadata?.role
  if ((targetRole === 'admin' || targetRole === 'superadmin') && role !== 'superadmin') {
    return NextResponse.json({ error: '관리자 계정은 최고관리자만 초기화할 수 있습니다.' }, { status: 403 })
  }

  const tempPassword = genTempPassword()

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    // 임시 비밀번호 발급 이력 기록
    user_metadata: {
      ...(t.user_metadata || {}),
      temp_password_at: new Date().toISOString(),
      temp_password_by: user?.email || null,
    },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 이메일 발송 (선택)
  let emailed = false
  if (sendEmail && t.email && process.env.RESEND_API_KEY) {
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <div style="font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px;margin-bottom:4px;">SUPER HARD</div>
    <div style="color:#6b7280;font-size:12px;margin-bottom:24px;">DTF 출력 전문 서비스</div>
    <h1 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 12px;">임시 비밀번호가 발급되었습니다 🔑</h1>
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;">
      요청하신 임시 비밀번호입니다. 아래 비밀번호로 로그인한 뒤 <b>반드시 새 비밀번호로 변경</b>해주세요.
    </p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="color:#1d4ed8;font-size:12px;font-weight:700;margin:0 0 6px;">임시 비밀번호</p>
      <p style="color:#111827;font-size:24px;font-weight:800;letter-spacing:2px;margin:0;font-family:monospace;">${tempPassword}</p>
    </div>
    <a href="${SITE}/login?tab=login" style="display:block;background:#2563eb;color:white;text-align:center;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;">
      로그인하러 가기 →
    </a>
    <p style="color:#9ca3af;font-size:11px;margin-top:22px;line-height:1.6;">
      본인이 요청하지 않았다면 즉시 문의해주세요.<br />문의: ${SUPPORT_EMAIL} · 고객센터 010-2560-9749
    </p>
  </div>
</div>`
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [t.email], subject: '[SUPER HARD] 임시 비밀번호가 발급되었습니다', html }),
      })
      emailed = res.ok
      if (emailed) {
        try {
          await supabaseAdmin.from('email_logs').insert({
            type: 'temp_password', subject: '[SUPER HARD] 임시 비밀번호 발급',
            scope: 'single', sent_count: 1, sent_by: user?.email || null,
          })
        } catch { /* 무시 */ }
      }
    } catch { /* 메일 실패해도 발급은 완료 */ }
  }

  return NextResponse.json({ success: true, tempPassword, email: t.email, emailed })
}
