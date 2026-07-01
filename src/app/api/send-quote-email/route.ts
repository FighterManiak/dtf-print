export const dynamic = 'force-dynamic'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { userEmail, userName, productType, quantity, unit, unitPrice, cuttingPrice, totalAmount, adminNote, quoteId } = await req.json()

  const { error } = await resend.emails.send({
    from: 'SUPER HARD <onboarding@resend.dev>',
    to: userEmail,
    subject: '[SUPER HARD] 견적이 도착했습니다 🖨️',
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <h1 style="font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 8px;">견적이 도착했습니다!</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 28px;">${userName}님, 요청하신 견적을 확인해주세요.</p>

          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 6px 0; width: 100px;">상품 유형</td>
                <td style="color: #111827; font-weight: 600;">${productType}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">출력 수량</td>
                <td style="color: #111827; font-weight: 600;">${quantity}${unit}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">단가</td>
                <td style="color: #111827;">${Number(unitPrice).toLocaleString()}원</td>
              </tr>
              ${cuttingPrice > 0 ? `
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">컷팅</td>
                <td style="color: #111827;">+${Number(cuttingPrice).toLocaleString()}원</td>
              </tr>` : ''}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="color: #374151; padding: 12px 0 6px; font-weight: 700;">최종 금액</td>
                <td style="color: #2563eb; font-weight: 800; font-size: 18px; padding-top: 12px;">${Number(totalAmount).toLocaleString()}원</td>
              </tr>
            </table>
          </div>

          ${adminNote ? `
          <div style="background: #eff6ff; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #1d4ed8; font-size: 13px; font-weight: 700; margin: 0 0 4px;">담당자 메모</p>
            <p style="color: #374151; font-size: 14px; margin: 0;">${adminNote}</p>
          </div>` : ''}

          <a href="https://dtf-print.vercel.app/my-quotes"
            style="display: block; background: #2563eb; color: white; text-align: center; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none;">
            결제하러 가기 →
          </a>

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            SUPER HARD DTF 출력 서비스 · 문의: 1:1 채팅
          </p>
        </div>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true })
}
