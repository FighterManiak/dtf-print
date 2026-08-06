'use client'

import Link from 'next/link'
import { ArrowRight, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

interface Slide {
  badge: string
  title: React.ReactNode
  desc: React.ReactNode
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
}

const grad = 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'

// 비메오 배경 영상 ID (비워두면 영상 없이 기존 배경만 표시)
// 예: 'https://vimeo.com/76979871' → ID는 76979871
const VIMEO_BG_ID = ''
const VIDEO_OPACITY = 0.35 // 0(투명)~1(불투명)

const SLIDES: Slide[] = [
  {
    badge: '국내 최고 품질의 DTF 출력 서비스',
    title: <>당신의 디자인을<br /><span className={grad}>현실로 만드세요</span></>,
    desc: <>시안 파일 업로드부터 출력·발송까지.<br />빠르고 선명한 DTF 출력을 경험하세요.</>,
    primary: { label: '지금 주문하기', href: '/order' },
    secondary: { label: '상품 보기', href: '/#products' },
  },
  {
    badge: 'DTF 장비 보유 고객 전용 특가',
    title: <>장비 보유 인증하고<br /><span className={grad}>전용 특가로 출력</span></>,
    desc: <>i3200 2HEAD 이상 장비 보유 시 인증 가능.<br />인증 회원 전용 단가로 더 저렴하게 이용하세요.</>,
    primary: { label: '주문하러 가기', href: '/order' },
    secondary: { label: '상품 보기', href: '/#products' },
  },
  {
    badge: 'MEMBERSHIP · 등급 혜택',
    title: <>많이 쓸수록<br /><span className={grad}>커지는 포인트 혜택</span></>,
    desc: <>전월 사용량에 따라 등급이 오르고,<br />VIP는 구매액의 <b className="text-white">최대 3%</b>를 포인트로 적립해드려요.</>,
    primary: { label: '등급 혜택 보기', href: '/grade' },
    secondary: { label: '지금 주문하기', href: '/order' },
  },
  {
    badge: 'OUR INFRASTRUCTURE',
    title: <>규모가 다른<br /><span className={grad}>압도적 생산 인프라</span></>,
    desc: <>DTF 프린터 16대 · 듀얼 프레스 16대.<br />대량 주문도 밀림 없이 빠르게 소화합니다.</>,
    primary: { label: '지금 주문하기', href: '/order' },
    secondary: { label: '상품 보기', href: '/#products' },
  },
]

export default function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  // 접속마다 슬라이드 순서 랜덤 (하이드레이션 불일치 방지 위해 마운트 후 섞음)
  const [order, setOrder] = useState<number[]>(() => SLIDES.map((_, i) => i))
  const count = SLIDES.length

  useEffect(() => {
    const arr = SLIDES.map((_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setOrder(arr)
    setIndex(0)
  }, [])

  const go = useCallback((i: number) => setIndex((i + count) % count), [count])
  const next = useCallback(() => go(index + 1), [go, index])
  const prev = useCallback(() => go(index - 1), [go, index])

  // 자동 넘김 (5초) — hover/터치 시 일시정지
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setIndex((p) => (p + 1) % count), 5000)
    return () => clearInterval(t)
  }, [paused, count])

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx > 50) prev()
    else if (dx < -50) next()
    touchX.current = null
  }

  return (
    <section className="relative overflow-hidden bg-[#0f0f0f] text-white">
      {/* 비메오 배경 영상 (투명도 적용) */}
      {VIMEO_BG_ID && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: VIDEO_OPACITY }}>
          <iframe
            src={`https://player.vimeo.com/video/${VIMEO_BG_ID}?background=1&autoplay=1&loop=1&muted=1&autopause=0`}
            allow="autoplay; fullscreen"
            title="배경 영상"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
            style={{ width: '100vw', height: '56.25vw', minHeight: '100%', minWidth: '177.78vh' }}
          />
        </div>
      )}
      {/* 영상 위 어둡게 (글자 가독성) */}
      {VIMEO_BG_ID && <div className="absolute inset-0 bg-[#0f0f0f]/50 pointer-events-none" />}

      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 pt-12 md:pt-20 pb-10 md:pb-16"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* 슬라이드 뷰포트 */}
        <div className="overflow-hidden">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
            {order.map((slideIdx, i) => {
              const s = SLIDES[slideIdx]
              return (
              <div key={i} className="w-full shrink-0 flex flex-col items-center text-center gap-6 md:gap-8 px-1">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs md:text-sm font-medium text-white/80 backdrop-blur-sm">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  {s.badge}
                </div>
                <h1 className="text-4xl md:text-7xl font-extrabold leading-tight tracking-tight min-h-[6rem] md:min-h-[9rem] flex items-center">
                  <span>{s.title}</span>
                </h1>
                <p className="text-base md:text-xl text-white/60 max-w-xl leading-relaxed min-h-[3.5rem]">{s.desc}</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-1">
                  <Link href={s.primary.href}
                    className="inline-flex items-center justify-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-2xl hover:bg-gray-100 transition-all text-base shadow-lg shadow-white/10">
                    {s.primary.label} <ArrowRight className="w-4 h-4" />
                  </Link>
                  {s.secondary && (
                    <Link href={s.secondary.href}
                      className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-8 py-4 rounded-2xl hover:bg-white/20 transition-all text-base backdrop-blur-sm">
                      {s.secondary.label}
                    </Link>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* 좌우 화살표 */}
        <button onClick={prev} aria-label="이전"
          className="absolute left-1 md:left-3 top-[38%] -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={next} aria-label="다음"
          className="absolute right-1 md:right-3 top-[38%] -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* 점(dot) 네비게이션 */}
        <div className="flex justify-center gap-2 mt-6">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)} aria-label={`슬라이드 ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`} />
          ))}
        </div>

        {/* 신뢰 지표 (고정) */}
        <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-6 md:gap-8 mt-8 pt-6 md:pt-8 border-t border-white/10 w-full">
          {[
            { value: '10,000+', label: '누적 주문' },
            { value: '99.8%', label: '고객 만족도' },
            { value: '1-3일', label: '평균 출력·발송' },
            { value: '24시간', label: '고객 지원' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-xl md:text-2xl font-bold text-white">{value}</div>
              <div className="text-xs md:text-sm text-white/50 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* 문의 전화 (고정) */}
        <div className="mt-6 text-center">
          <a href="tel:010-8231-8604" className="inline-flex items-center gap-2.5 text-white/90 hover:text-white transition-colors">
            <span className="text-lg md:text-xl text-white">문의</span>
            <span className="text-2xl md:text-3xl font-bold tracking-wide">010-8231-8604</span>
          </a>
        </div>
      </div>
    </section>
  )
}
