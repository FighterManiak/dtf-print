import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SUPER HARD — DTF 전사 출력 전문'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND = 'SUPER HARD'
const TAGLINE = 'DTF 전사 출력 전문'
const LINE1 = 'A4 · A3 · 59cm 롤 출력'
const CHIPS = ['당일 출고', '대량 주문', 'DTF 자재 판매']
const DOMAIN = 'superhard.co.kr'
const TEL = '010-2560-9749'

// 구글 폰트에서 필요한 글자만 받아옴 (한글 전체를 받으면 너무 무거움)
async function loadFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await fetch(url, {
      headers: {
        // 구형 UA로 요청해야 woff2 대신 ttf 를 내려줌 (satori는 woff2 미지원)
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    }).then((r) => r.text())

    const src = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
    if (!src) return null
    return await fetch(src).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

export default async function OgImage() {
  const koText = TAGLINE + LINE1 + CHIPS.join('') + '전사출력전문당일대량자재판매롤'
  const [bold, regular] = await Promise.all([
    loadFont(800, koText + BRAND),
    loadFont(500, koText + DOMAIN + TEL),
  ])

  const fonts = [
    ...(bold ? [{ name: 'Noto', data: bold, weight: 800 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'Noto', data: regular, weight: 500 as const, style: 'normal' as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', position: 'relative',
          background: 'linear-gradient(135deg, #000000 0%, #0d0d0d 55%, #1a1a1a 100%)',
          fontFamily: fonts.length ? 'Noto' : 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* 우상단 은은한 라이트 */}
        <div style={{
          position: 'absolute', top: -320, right: -240, width: 820, height: 820, borderRadius: 999,
          background: 'radial-gradient(circle, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 45%, rgba(0,0,0,0) 70%)',
          display: 'flex',
        }} />

        {/* 좌측 액센트 바 */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 12,
          background: '#ffffff',
          display: 'flex',
        }} />

        {/* 하단 미세 구분선 */}
        <div style={{
          position: 'absolute', left: 88, right: 88, bottom: 74, height: 1,
          background: 'rgba(255,255,255,0.14)', display: 'flex',
        }} />

        {/* 본문 */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '0 88px', width: '100%', height: '100%',
        }}>
          {/* 상단 라벨 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 26 }}>
            <div style={{ width: 34, height: 3, background: 'rgba(255,255,255,0.65)', display: 'flex', marginRight: 14 }} />
            <span style={{ fontSize: 27, fontWeight: 500, color: '#b8b8b8', letterSpacing: 5 }}>{TAGLINE}</span>
          </div>

          {/* 브랜드 */}
          <div style={{
            display: 'flex', fontSize: 132, fontWeight: 800, color: '#ffffff',
            letterSpacing: -4, lineHeight: 1.02, marginBottom: 30,
          }}>
            {BRAND}
          </div>

          {/* 서비스 라인 */}
          <div style={{ display: 'flex', fontSize: 35, fontWeight: 500, color: '#e8e8e8', marginBottom: 34 }}>
            {LINE1}
          </div>

          {/* 특징 칩 */}
          <div style={{ display: 'flex', marginBottom: 62 }}>
            {CHIPS.map((c) => (
              <div key={c} style={{
                display: 'flex', alignItems: 'center',
                padding: '13px 27px', marginRight: 14, borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.32)',
                fontSize: 25, fontWeight: 500, color: '#ffffff',
              }}>
                {c}
              </div>
            ))}
          </div>

          {/* 하단 */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5 }}>{DOMAIN}</span>
            <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.3)', display: 'flex', margin: '0 22px' }} />
            <span style={{ fontSize: 27, fontWeight: 500, color: '#999999' }}>{TEL}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
