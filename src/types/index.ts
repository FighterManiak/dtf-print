export type ProductId = 'A4' | 'A3' | 'roll_58_1m' | 'roll_58_50m' | 'roll_58_100m' | 'roll_58_1m_verified'

export type UserRole = 'user' | 'dtf_verified' | 'admin'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export interface DtfVerification {
  id: string
  user_id: string
  user_email: string
  user_name: string
  file_urls: string[]
  status: VerificationStatus
  created_at: string
  reviewed_at: string | null
  reject_reason: string | null
}

export interface Product {
  id: ProductId
  name: string
  description: string
  price: number
  unit: string
  verifiedOnly?: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: ProductId
  quantity: number
  cutting: boolean
  file_url: string | null
  file_name: string | null
  request_note: string | null
  unit_price: number
}

export interface Order {
  id: string
  created_at: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  status: OrderStatus
  total_amount: number
  payment_key: string | null
  payment_method: string | null
  tracking_number: string | null
  items?: OrderItem[]
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'in_progress'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  in_progress: '작업 중',
  shipped: '출고 완료',
  delivered: '배송 완료',
  cancelled: '취소',
  refund_requested: '환불 요청',
  refunded: '환불 완료',
}

export const PRODUCTS: Product[] = [
  { id: 'A4', name: 'A4 출력', description: 'A4 사이즈 DTF 출력 (210×297mm)', price: 3000, unit: '장' },
  { id: 'A3', name: 'A3 출력', description: 'A3 사이즈 DTF 출력 (297×420mm)', price: 5000, unit: '장' },
  { id: 'roll_58_1m', name: '58cm × 1M 이상', description: '58cm 폭 롤 출력, 1M 단위', price: 8900, unit: 'M' },
  { id: 'roll_58_50m', name: '58cm × 50M 이상', description: '58cm 폭 롤 출력, 50M 이상 주문', price: 7900, unit: 'M' },
  { id: 'roll_58_100m', name: '58cm × 100M 이상', description: '58cm 폭 롤 출력, 100M 이상 주문', price: 6900, unit: 'M' },
]

export const VERIFIED_PRODUCTS: Product[] = [
  {
    id: 'roll_58_1m_verified',
    name: '58cm × 1M 이상 (인증 전용)',
    description: '58cm 폭 롤 출력, 1M 단위 — DTF 장비 보유 인증 고객 전용',
    price: 4400,
    unit: 'M',
    verifiedOnly: true,
  },
]
