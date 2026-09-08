import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DTF 출력 바로주문',
  description: 'A4·A3·57cm 롤 DTF 전사 출력을 바로 주문하세요. 시안 업로드 후 수량만 선택하면 견적 없이 즉시 결제됩니다.',
  alternates: { canonical: '/order' },
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children
}
