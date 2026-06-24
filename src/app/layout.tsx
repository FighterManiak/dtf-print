import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Header from '@/components/ui/Header'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DTF 출력 서비스',
  description: '고품질 DTF 출력 전문 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.className} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="bg-[#0f0f0f] text-gray-500 text-sm py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-bold text-white">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-xs">D</div>
              DTF 출력 서비스
            </div>
            <p className="text-gray-600">© 2024 DTF 출력 서비스. All rights reserved.</p>
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
