import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DTF 출력 견적 요청',
  description: '대량 주문이나 특수 규격도 문의하세요. 시안과 요청사항을 남기시면 담당자가 확인 후 견적을 보내드립니다.',
  alternates: { canonical: '/quote/request' },
}

export default function QuoteRequestLayout({ children }: { children: React.ReactNode }) {
  return children
}
