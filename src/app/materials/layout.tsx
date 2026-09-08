import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DTF 자재 구매',
  description: 'DTF 전사필름·파우더·잉크 등 DTF 작업에 필요한 자재를 합리적인 가격에 구매하세요. 회원 등급별 포인트 적립.',
  alternates: { canonical: '/materials' },
}

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return children
}
