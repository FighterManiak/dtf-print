'use client'

import { useState, useMemo } from 'react'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types'
import { Download, Search, ShoppingBag, TrendingUp, ShieldCheck } from 'lucide-react'

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const SAMPLE_ORDERS = [
  {
    id: 'ORD-001',
    created_at: '2024-01-15',
    customer_name: '홍길동',
    customer_email: 'hong@example.com',
    customer_phone: '010-1234-5678',
    customer_address: '서울시 강남구 테헤란로 123',
    dtf_verified: true,
    status: 'paid' as OrderStatus,
    total_amount: 15000,
    tracking_number: '',
    items: [
      { product_name: 'A4 출력', quantity: 3, unit: '장', cutting: true, due_date: '2024-01-20', file_name: 'design_v1.png', request_note: '색상 선명하게 부탁드립니다' },
    ],
  },
  {
    id: 'ORD-002',
    created_at: '2024-01-16',
    customer_name: '김철수',
    customer_email: 'kim@example.com',
    customer_phone: '010-9876-5432',
    customer_address: '부산시 해운대구 센텀로 45',
    dtf_verified: false,
    status: 'in_progress' as OrderStatus,
    total_amount: 395000,
    tracking_number: '',
    items: [
      { product_name: '58cm × 50M 이상', quantity: 50, unit: 'M', cutting: false, due_date: '2024-01-22', file_name: 'logo_print.ai', request_note: '' },
    ],
  },
  {
    id: 'ORD-003',
    created_at: '2024-01-17',
    customer_name: '이영희',
    customer_email: 'lee@example.com',
    customer_phone: '010-5555-7777',
    customer_address: '대구시 중구 동성로 67',
    dtf_verified: true,
    status: 'shipped' as OrderStatus,
    total_amount: 10000,
    tracking_number: '1234567890123',
    items: [
      { product_name: 'A3 출력', quantity: 2, unit: '장', cutting: true, due_date: '2024-01-19', file_name: 'banner.pdf', request_note: '여백 없이 재단해주세요' },
    ],
  },
]

export default function AdminOrdersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<Record<string, OrderStatus>>(
    Object.fromEntries(SAMPLE_ORDERS.map((o) => [o.id, o.status]))
  )

  // 고객별 최근 1년 통계
  const customerStats = useMemo(() => {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const stats: Record<string, { count: number; total: number }> = {}
    SAMPLE_ORDERS.forEach((o) => {
      const orderDate = new Date(o.created_at)
      if (orderDate >= oneYearAgo && o.status !== 'cancelled') {
        if (!stats[o.customer_email]) stats[o.customer_email] = { count: 0, total: 0 }
        stats[o.customer_email].count += 1
        stats[o.customer_email].total += o.total_amount
      }
    })
    return stats
  }, [])

  const filtered = SAMPLE_ORDERS.filter((o) => {
    const matchStatus = statusFilter === 'all' || statuses[o.id] === statusFilter
    const matchSearch =
      !search ||
      o.customer_name.includes(search) ||
      o.customer_email.includes(search) ||
      o.id.includes(search) ||
      o.customer_phone.includes(search)
    return matchStatus && matchSearch
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">주문 관리</h1>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center border border-gray-300 rounded-xl px-3 gap-2 bg-white">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명, 연락처, 주문번호 검색"
            className="py-2.5 text-sm focus:outline-none w-52 text-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            전체
          </button>
          {(Object.entries(ORDER_STATUS_LABEL) as [OrderStatus, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 주문 카드 목록 */}
      <div className="space-y-5">
        {filtered.map((order) => (
          <div key={order.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

            {/* 상단: 주문 기본 정보 */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-gray-400 block">주문번호</span>
                  <span className="font-bold text-gray-800">{order.id}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">주문일</span>
                  <span className="text-sm text-gray-700">{order.created_at}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">결제금액</span>
                  <span className="font-bold text-blue-600">{order.total_amount.toLocaleString()}원</span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                    <div>
                      <span className="text-xs text-gray-400 block">최근 1년 주문</span>
                      <span className="text-sm font-bold text-gray-700">{customerStats[order.customer_email]?.count ?? 0}건</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                    <div>
                      <span className="text-xs text-gray-400 block">누적 주문금액</span>
                      <span className="text-sm font-bold text-gray-700">{(customerStats[order.customer_email]?.total ?? 0).toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_COLOR[statuses[order.id]]}`}>
                {ORDER_STATUS_LABEL[statuses[order.id]]}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

              {/* 고객 정보 */}
              <div className="px-6 py-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">고객 정보</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">이름</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800">{order.customer_name}</span>
                      {order.dtf_verified ? (
                        <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" />
                          DTF인증
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                          미인증
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">연락처</span>
                    <span className="text-sm text-gray-700">{order.customer_phone}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">이메일</span>
                    <span className="text-sm text-gray-700 break-all">{order.customer_email}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">주소</span>
                    <span className="text-sm text-gray-700">{order.customer_address}</span>
                  </div>
                </div>
              </div>

              {/* 주문 상품 */}
              <div className="px-6 py-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 상품</p>
                {order.items.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">상품</span>
                      <span className="text-sm font-semibold text-gray-800">{item.product_name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">수량</span>
                      <span className="text-sm text-gray-700">{item.quantity}{item.unit}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">컷팅</span>
                      <span className="text-sm text-gray-700">{item.cutting ? '있음' : '없음'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">납기일</span>
                      <span className="text-sm text-gray-700">{item.due_date || '—'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">요청사항</span>
                      <span className="text-sm text-gray-700">{item.request_note || '—'}</span>
                    </div>
                    {item.file_name && (
                      <button className="flex items-center gap-1.5 mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                        <Download className="w-3.5 h-3.5" />
                        {item.file_name}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 처리 */}
              <div className="px-6 py-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 처리</p>
                <div className="space-y-3">
                  {/* 상태 변경 */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">상태 변경</label>
                    <div className="flex gap-2">
                      <select
                        value={statuses[order.id]}
                        onChange={(e) => setStatuses((p) => ({ ...p, [order.id]: e.target.value as OrderStatus }))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {(Object.entries(ORDER_STATUS_LABEL) as [OrderStatus, string][]).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <button className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        저장
                      </button>
                    </div>
                  </div>

                  {/* 송장번호 */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">택배사 / 송장번호</label>
                    <div className="space-y-2">
                      <select
                        value={carrierInputs[order.id] ?? ''}
                        onChange={(e) => setCarrierInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">택배사 선택</option>
                        <option value="CJ대한통운">CJ대한통운</option>
                        <option value="한진택배">한진택배</option>
                        <option value="롯데택배">롯데택배</option>
                        <option value="우체국택배">우체국택배</option>
                        <option value="로젠택배">로젠택배</option>
                        <option value="경동택배">경동택배</option>
                        <option value="대신택배">대신택배</option>
                        <option value="일양로지스">일양로지스</option>
                        <option value="쿠팡로켓배송">쿠팡로켓배송</option>
                        <option value="직접배송">직접배송</option>
                      </select>
                      <div className="flex gap-2">
                        <input
                          value={trackingInputs[order.id] ?? order.tracking_number}
                          onChange={(e) => setTrackingInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                          placeholder="운송장 번호 입력"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button className="border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                          저장
                        </button>
                      </div>
                    </div>
                    {order.tracking_number && (
                      <p className="text-xs text-green-600 mt-1">현재: {order.tracking_number}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">주문이 없습니다.</div>
        )}
      </div>
    </div>
  )
}
