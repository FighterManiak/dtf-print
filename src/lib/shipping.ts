// 배송비 정책
// - 소계 9,900원 이상: 기본 배송비 무료
// - 소계 9,900원 미만: 기본 배송비 3,000원
// - 제주: +3,000원 (무료배송이어도 별도 부과)
// - 그 외 도서산간: +5,000원 (무료배송이어도 별도 부과)

export const FREE_SHIPPING_THRESHOLD = 9900
export const BASE_SHIPPING_FEE = 3000
export const JEJU_SURCHARGE = 3000
export const ISLAND_SURCHARGE = 5000

// 제주 우편번호 범위 (정확): 63000 ~ 63644
function isJeju(zonecode: string): boolean {
  const n = parseInt(zonecode, 10)
  return !Number.isNaN(n) && n >= 63000 && n <= 63644
}

// 그 외 도서산간 우편번호 범위 (편집 가능 — 실제 택배사 도서산간 목록에 맞게 조정하세요)
// 아래는 대표적인 섬 지역 범위입니다. 필요 시 [시작, 끝] 쌍을 추가/수정하세요.
const ISLAND_RANGES: [number, number][] = [
  [40200, 40240], // 경상북도 울릉군 (울릉도·독도)
  [23004, 23010], // 인천 옹진군 백령면·대청면
  [23100, 23136], // 인천 옹진군 덕적·자월·영흥·북도면
  [53031, 53033], // 경남 통영시 한산면·사량면
  [53088, 53104], // 경남 통영시 욕지면·연화리 등
  [58760, 58810], // 전남 신안군 도서
  [58900, 58965], // 전남 신안군·진도군 도서
  [59102, 59166], // 전남 완도군 도서
]

// 우편번호로 지역 추가 배송비 계산
export function getRegionSurcharge(zonecode: string): number {
  if (!zonecode) return 0
  if (isJeju(zonecode)) return JEJU_SURCHARGE
  const n = parseInt(zonecode, 10)
  if (Number.isNaN(n)) return 0
  for (const [lo, hi] of ISLAND_RANGES) {
    if (n >= lo && n <= hi) return ISLAND_SURCHARGE
  }
  return 0
}

export interface ShippingResult {
  base: number       // 기본 배송비
  surcharge: number  // 지역 추가 배송비
  total: number      // 총 배송비
  regionLabel: string // '제주' | '도서산간' | ''
}

export function getShippingFee(subtotal: number, zonecode: string): ShippingResult {
  const base = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING_FEE
  const surcharge = getRegionSurcharge(zonecode)
  const regionLabel = surcharge === JEJU_SURCHARGE ? '제주' : surcharge === ISLAND_SURCHARGE ? '도서산간' : ''
  return { base, surcharge, total: base + surcharge, regionLabel }
}
