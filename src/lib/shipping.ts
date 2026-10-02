// 배송비 정책
// - 소계 30,000원 이상: 기본 배송비 무료
// - 소계 30,000원 미만: 기본 배송비 3,000원
// - 제주: +3,000원 (무료배송이어도 별도 부과)
// - 그 외 도서산간: +5,000원 (무료배송이어도 별도 부과)

export const FREE_SHIPPING_THRESHOLD = 30000
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

// ─────────────────────────────────────────────────────────────
// 자재 상품별 택배비
// 상세페이지 표시와 주문 서버 계산이 같은 함수를 쓰도록 여기에 모음
// ─────────────────────────────────────────────────────────────
export type MaterialShippingType = 'default' | 'free' | 'fixed' | 'conditional' | 'per_qty'

export interface MaterialShipping {
  type: MaterialShippingType
  fee: number        // 택배비 (고정·조건부·수량별)
  freeOver: number   // 조건부 무료 기준 금액
  perQty: number     // 수량별: 몇 개마다 택배비를 부과할지
}

export const MATERIAL_SHIPPING_TYPES: { value: MaterialShippingType; label: string }[] = [
  { value: 'default', label: '기본 정책' },
  { value: 'free', label: '무료배송' },
  { value: 'fixed', label: '고정 택배비' },
  { value: 'conditional', label: '조건부 무료' },
  { value: 'per_qty', label: '수량별 부과' },
]

const toInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

// 저장된 값(없거나 잘못된 값 포함)을 안전한 설정으로 정리
export function normalizeMaterialShipping(raw: unknown): MaterialShipping {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const type = MATERIAL_SHIPPING_TYPES.some((t) => t.value === r.type) ? (r.type as MaterialShippingType) : 'default'
  return {
    type,
    fee: toInt(r.fee, 0, 1_000_000, BASE_SHIPPING_FEE),
    freeOver: toInt(r.freeOver, 0, 100_000_000, FREE_SHIPPING_THRESHOLD),
    perQty: toInt(r.perQty, 1, 10_000, 1),
  }
}

// 기본 정책이 아닌 상품 1건의 택배비 (지역 추가비 제외)
export function materialItemFee(s: MaterialShipping, amount: number, qty: number): number {
  switch (s.type) {
    case 'free': return 0
    case 'fixed': return s.fee
    case 'conditional': return amount >= s.freeOver ? 0 : s.fee
    case 'per_qty': return s.fee * Math.ceil(Math.max(1, qty) / s.perQty)
    default: return amount >= FREE_SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING_FEE
  }
}

// 고객에게 보여줄 택배비 규칙 문장
export function describeMaterialShipping(s: MaterialShipping): string {
  const w = (n: number) => `${n.toLocaleString()}원`
  switch (s.type) {
    case 'free': return '무료배송'
    case 'fixed': return `택배비 ${w(s.fee)}`
    case 'conditional': return `${w(s.freeOver)} 이상 무료배송, 미만 ${w(s.fee)}`
    case 'per_qty': return s.perQty === 1 ? `1개마다 ${w(s.fee)}` : `${s.perQty}개마다 ${w(s.fee)}`
    default: return `${w(FREE_SHIPPING_THRESHOLD)} 이상 무료배송, 미만 ${w(BASE_SHIPPING_FEE)}`
  }
}

// 주문 전체 택배비
// - 기본 정책 상품끼리는 금액을 합쳐서 무료배송 여부를 판단
// - 나머지는 상품별 규칙대로 계산해 더함
// - 제주·도서산간 추가비는 주문당 한 번
export function getMaterialShippingFee(
  items: { amount: number; qty: number; shipping: MaterialShipping }[],
  zonecode: string
): ShippingResult {
  if (items.length === 0) return { base: 0, surcharge: 0, total: 0, regionLabel: '' }

  const defaults = items.filter((i) => i.shipping.type === 'default')
  const defaultSubtotal = defaults.reduce((s, i) => s + i.amount, 0)
  let base = defaults.length > 0 ? (defaultSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING_FEE) : 0
  items.filter((i) => i.shipping.type !== 'default').forEach((i) => { base += materialItemFee(i.shipping, i.amount, i.qty) })

  const surcharge = getRegionSurcharge(zonecode)
  const regionLabel = surcharge === JEJU_SURCHARGE ? '제주' : surcharge === ISLAND_SURCHARGE ? '도서산간' : ''
  return { base, surcharge, total: base + surcharge, regionLabel }
}
