import type { SupabaseClient } from '@supabase/supabase-js'
import { getShippingFee } from '@/lib/shipping'
import { getAvailablePoints } from '@/lib/points-server'
import { POINT_USE_THRESHOLD } from '@/lib/grade'

// 바로주문 금액을 서버에서 다시 계산 (주문 페이지 계산식과 동일)
// - 상품 단가는 DB(products) 기준, 롤 상품 컷팅은 1m당 1,000원
// - 배송비는 소계·우편번호 기준, 직접 수령은 0원
// - 포인트는 보유 1만P 이상일 때 구매금액의 20%까지 (최소 결제 100원)
export const CUTTING_PRICE_PER_M = 1000
const POINT_MAX_RATE = 0.2

export interface CartInput {
  productId: string
  quantity: number
  cutting: boolean
  cuttingPrice: number
  requestNote?: string
  dueDate?: string | null
  filePath?: string | null
  fileName?: string | null
}

export interface PricedOrder {
  items: (CartInput & { unitPrice: number; cuttingPrice: number })[]
  subtotal: number
  shipping: number
  usedPoints: number
  total: number
}

export async function priceOrder(
  admin: SupabaseClient,
  opts: { cart: CartInput[]; zonecode: string; pickup: boolean; requestedPoints: number; userId: string | null },
): Promise<{ ok: true; order: PricedOrder } | { ok: false; error: string }> {
  const cart = Array.isArray(opts.cart) ? opts.cart : []
  if (cart.length === 0) return { ok: false, error: '주문 상품이 없습니다.' }

  const ids = [...new Set(cart.map((c) => String(c.productId)))]
  const { data: products } = await admin.from('products').select('id,name,price,is_roll,active').in('id', ids)
  const map = new Map((products || []).map((p) => [String(p.id), p]))

  const items: PricedOrder['items'] = []
  let subtotal = 0
  for (const c of cart) {
    const p = map.get(String(c.productId))
    if (!p || p.active === false) return { ok: false, error: '판매하지 않는 상품이 포함되어 있습니다. 새로고침 후 다시 주문해주세요.' }
    const qty = Number(c.quantity)
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: '수량이 올바르지 않습니다.' }
    const unitPrice = Number(p.price) || 0
    const cut = c.cutting ? (p.is_roll ? qty * CUTTING_PRICE_PER_M : Math.max(0, Math.round(Number(c.cuttingPrice) || 0))) : 0
    subtotal += unitPrice * qty + cut
    items.push({ ...c, unitPrice, cuttingPrice: cut })
  }

  const shipping = opts.pickup ? 0 : getShippingFee(subtotal, opts.zonecode || '').total
  const payable = subtotal + shipping

  let usedPoints = 0
  const requested = Math.max(0, Math.round(Number(opts.requestedPoints) || 0))
  if (requested > 0 && opts.userId) {
    const available = await getAvailablePoints(admin, opts.userId)
    if (available >= POINT_USE_THRESHOLD) {
      usedPoints = Math.max(0, Math.min(requested, available, Math.floor(payable * POINT_MAX_RATE), payable - 100))
    }
  }

  return { ok: true, order: { items, subtotal, shipping, usedPoints, total: Math.round(payable - usedPoints) } }
}
