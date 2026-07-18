import type { Metadata } from 'next'
import { Geist, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Header from '@/components/ui/Header'
import ChatWidget from '@/components/ui/ChatWidget'
import ProfileGuard from '@/components/ui/ProfileGuard'

const geist = Geist({ subsets: ['latin'] })
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-barlow-condensed',
})

export const metadata: Metadata = {
  title: 'DTF 출력 서비스',
  description: '고품질 DTF 출력 전문 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.className} ${barlowCondensed.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* 베타 오픈 안내 배너 */}
        <div className="bg-violet-600 text-white text-center text-xs sm:text-sm px-4 py-2 font-medium">
          🎉 현재 <b>베타 버전</b>으로 운영 중입니다 — <b>2026년 8월 1일 정식 오픈</b> 예정 · 회원가입은 지금 바로 가능합니다
        </div>
        <Header />
        <ProfileGuard />
        <main className="flex-1">{children}</main>
        <ChatWidget />
        <footer className="bg-[#0f0f0f] text-gray-500 text-sm py-10 px-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="font-[family-name:var(--font-barlow-condensed)] font-bold text-white text-[1.8rem] tracking-tight">
                SUPER HARD
              </div>
              <div className="flex gap-6">
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
                <span className="text-gray-400">고객센터</span> 010-2803-8603&nbsp;&nbsp;·&nbsp;&nbsp;
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
