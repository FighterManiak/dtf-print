import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SUPER HARD — DTF 전사 출력 전문'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 카카오톡·문자·SNS 공유 시 노출되는 썸네일
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1e1b4b 55%, #1e3a8a 100%)',
          color: 'white', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 104, fontWeight: 900, letterSpacing: -3, display: 'flex' }}>
          SUPER HARD
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#93c5fd', marginTop: 12, display: 'flex' }}>
          DTF 전사 출력 전문
        </div>
        <div style={{ fontSize: 26, color: '#cbd5e1', marginTop: 28, display: 'flex' }}>
          A4 · A3 · 57cm 롤 출력 &nbsp;|&nbsp; 당일 출고 &nbsp;|&nbsp; DTF 자재 판매
        </div>
        <div style={{ fontSize: 22, color: '#64748b', marginTop: 44, display: 'flex' }}>
          superhard.co.kr
        </div>
      </div>
    ),
    size
  )
}
