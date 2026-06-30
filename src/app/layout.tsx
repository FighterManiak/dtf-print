import type { Metadata } from 'next'
import { Geist, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import Header from '@/components/ui/Header'
import ChatWidget from '@/components/ui/ChatWidget'

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
        <Header />
        <main className="flex-1">{children}</main>
        <ChatWidget />
        <footer className="bg-[#0f0f0f] text-gray-500 text-sm py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="font-[family-name:var(--font-barlow-condensed)] font-bold text-white text-[1.8rem] tracking-tight">
              SUPER HARD
            </div>
            <p className="text-gray-600">© 2024 SUPER HARD. All rights reserved.</p>
            <div className="flex gap-6 text-gray-600">
              <span className="hover:text-white cursor-pointer transition-colors">이용약관</span>
              <span className="hover:text-white cursor-pointer transition-colors">개인정보처리방침</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
