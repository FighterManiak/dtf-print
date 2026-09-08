import type { Metadata } from 'next'
import { Geist, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Header from '@/components/ui/Header'
import ChatWidget from '@/components/ui/ChatWidget'
import ProfileGuard from '@/components/ui/ProfileGuard'
import VisitTracker from '@/components/ui/VisitTracker'

const geist = Geist({ subsets: ['latin'] })
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-barlow-condensed',
})

const SITE_URL = 'https://www.superhard.co.kr'
const SITE_NAME = 'SUPER HARD'
const SITE_DESC =
  'DTF 전사 출력 전문. A4·A3·57cm 롤 출력을 합리적인 가격에, 당일 출고로 빠르게. DTF 필름·파우더 등 자재도 함께 판매합니다.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SUPER HARD | DTF 전사 출력 전문',
    template: '%s | SUPER HARD',
  },
  description: SITE_DESC,
  keywords: ['DTF', 'DTF출력', 'DTF전사', 'DTF필름', '전사출력', '나염', '롤출력', '의류프린팅', '슈퍼하드', '부산 DTF'],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'SUPER HARD | DTF 전사 출력 전문',
    description: SITE_DESC,
    // 썸네일은 opengraph-image.tsx 에서 자동 생성됨
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SUPER HARD | DTF 전사 출력 전문',
    description: SITE_DESC,
  },
  verification: {
    other: {
      'naver-site-verification': 'c7732c90df1dbbf10bb3f400bf62c499f892bf2b',
      // 구글 서치콘솔 인증 코드를 발급받으면 아래 주석을 풀고 값을 넣으세요
      // 'google-site-verification': '여기에_인증코드',
    },
  },
}

// 사업자 정보 구조화 데이터 (지역 업체 검색 노출)
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}#business`,
  name: SITE_NAME,
  alternateName: '아유디스터디',
  description: SITE_DESC,
  url: SITE_URL,
  telephone: '+82-10-2560-9749',
  email: 'superhard.int@gmail.com',
  image: `${SITE_URL}/opengraph-image`,
  priceRange: '₩₩',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '장안읍 명례산단6로 14 1층',
    addressLocality: '기장군',
    addressRegion: '부산광역시',
    postalCode: '46028',
    addressCountry: 'KR',
  },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '18:00',
  }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.className} ${barlowCondensed.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {/* 이벤트 공지 배너 */}
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 text-white text-center text-xs sm:text-sm px-4 py-2.5 font-medium">
          🎉 <b>오픈 이벤트!</b> 지금 회원가입 시 <b>9월부터 1년간 VIP 등급(3% 적립)</b> 적용
        </div>
        <Header />
        <ProfileGuard />
        <VisitTracker />
        <main className="flex-1">{children}</main>
        <ChatWidget />
        <footer className="bg-[#0f0f0f] text-gray-500 text-sm py-10 px-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="font-[family-name:var(--font-barlow-condensed)] font-bold text-white text-[1.8rem] tracking-tight">
                SUPER HARD
              </div>
              <div className="flex gap-6">
                <a href="/grade" className="text-white hover:text-gray-300 transition-colors">회원등급 안내</a>
                <a href="/terms" className="text-white hover:text-gray-300 transition-colors">이용약관</a>
                <a href="/privacy" className="text-white hover:text-gray-300 transition-colors">개인정보처리방침</a>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6 text-gray-500 text-xs leading-relaxed space-y-1">
              <p>
                <span className="text-gray-400">상호</span> 아유디스터디&nbsp;&nbsp;·&nbsp;&nbsp;
                <span className="text-gray-400">대표</span> 조봉준&nbsp;&nbsp;·&nbsp;&nbsp;
                <span className="text-gray-400">사업자등록번호</span> 617-27-96956
              </p>
              <p>
                <span className="text-gray-400">통신판매업신고번호</span> 2010-부산해운-0173&nbsp;&nbsp;·&nbsp;&nbsp;
                <span className="text-gray-400">개인정보관리책임자</span> 조봉준
              </p>
              <p>
                <span className="text-gray-400">주소</span> 부산광역시 기장군 장안읍 명례산단6로 14 1층 (46028)
              </p>
              <p>
                <span className="text-gray-400">고객센터</span> 010-2560-9749&nbsp;&nbsp;·&nbsp;&nbsp;
                <span className="text-gray-400">이메일</span> superhard.int@gmail.com
              </p>
            </div>

            <p className="text-gray-600 text-xs">© {new Date().getFullYear()} SUPER HARD. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
