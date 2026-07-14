// 회원 등급 (지난 달 롤 출력 58cm 미터 합산 기준)
// - VIP: 500m 이상
// - GOLD: 200m 이상
// - SILVER: 50m 이상
// - 일반: 그 외
// ※ DTF 장비 보유 인증과는 별개의 등급

export const GRADE_THRESHOLDS = { vip: 500, gold: 200, silver: 50 } as const

export interface Grade {
  key: 'vip' | 'gold' | 'silver' | 'normal'
  label: string
  color: string
}

export function getGrade(meters: number): Grade {
  if (meters >= GRADE_THRESHOLDS.vip) return { key: 'vip', label: 'VIP', color: 'bg-purple-100 text-purple-700' }
  if (meters >= GRADE_THRESHOLDS.gold) return { key: 'gold', label: 'GOLD', color: 'bg-amber-100 text-amber-700' }
  if (meters >= GRADE_THRESHOLDS.silver) return { key: 'silver', label: 'SILVER', color: 'bg-slate-200 text-slate-700' }
  return { key: 'normal', label: '일반', color: 'bg-gray-100 text-gray-500' }
}

// 등급별 포인트 적립률
export const POINT_RATES: Record<Grade['key'], number> = { vip: 0.03, gold: 0.02, silver: 0.01, normal: 0 }
// 포인트 사용 가능 최소 보유 금액
export const POINT_USE_THRESHOLD = 10000
// 포인트 유효기간 (개월)
export const POINT_EXPIRY_MONTHS = 6

// 롤 출력(58cm) 상품 여부
export function isRollProduct(productId: string): boolean {
  return productId.startsWith('roll_58')
}
