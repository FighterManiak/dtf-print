export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// 솔라피(Solapi) 카카오 알림톡 발송
// 필요한 환경변수:
//   SOLAPI_API_KEY, SOLAPI_API_SECRET  — 솔라피 API 키
//   SOLAPI_SENDER                      — 등록된 발신번호 (숫자만, 예: 01028038603)
//   KAKAO_PFID                         — 카카오 채널 발신프로필 ID (채널 연동 후 발급)
//   KAKAO_TEMPLATE_QUOTE               — 승인된 '견적 발송' 알림톡 템플릿 ID

export async function POST(req: Request) {
  const { userName, userPhone, productType, totalAmount } = await req.json()

  const API_KEY = process.env.SOLAPI_API_KEY
  const API_SECRET = process.env.SOLAPI_API_SECRET
  const SENDER = process.env.SOLAPI_SENDER
  const PF_ID = process.env.KAKAO_PFID
  const TEMPLATE_ID = process.env.KAKAO_TEMPLATE_QUOTE

  // 환경변수 미설정 시 조용히 건너뜀 (이메일만 발송되도록)
  if (!API_KEY || !API_SECRET || !SENDER || !PF_ID || !TEMPLATE_ID) {
    return NextResponse.json({ skipped: true, reason: '알림톡 환경변수 미설정' })
  }
  if (!userPhone) {
    return NextResponse.json({ skipped: true, reason: '수신번호 없음' })
  }

  const to = String(userPhone).replace(/[^0-9]/g, '')

  // 솔라피 HMAC-SHA256 인증 헤더 생성
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(32).toString('hex')
  const signature = crypto.createHmac('sha256', API_SECRET).update(date + salt).digest('hex')
  const authorization = `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`

  // 템플릿 변수 — 승인된 템플릿의 #{변수}명과 반드시 일치해야 함
  const variables: Record<string, string> = {
    '#{고객명}': userName || '고객',
    '#{상품유형}': productType || '',
    '#{금액}': Number(totalAmount || 0).toLocaleString(),
  }

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        to,
        from: SENDER,
        kakaoOptions: { pfId: PF_ID, templateId: TEMPLATE_ID, variables },
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.errorMessage || '알림톡 발송 실패', detail: data }, { status: 400 })
  }
  return NextResponse.json({ success: true, data })
}
