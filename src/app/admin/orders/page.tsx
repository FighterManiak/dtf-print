'use client'

import { useState, useEffect, useMemo } from 'react'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types'
import { Download, Search, ShoppingBag, TrendingUp, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: 'in_progress',
  in_progress: 'shipped',
  shipped: 'delivered',
}

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  paid: '작업 시작',
  in_progress: '출고 처리',
  shipped: '배송 완료',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  refund_requested: 'bg-orange-100 text-orange-700',
  refunded: 'bg-gray-100 text-gray-500',
}

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  cutting: boolean
  cutting_price: number
  file_url: string | null
  file_name: string | null
  request_note: string | null
  due_date: string | null
  unit_price: number
}

interface Order {
  id: string
  created_at: string
  status: OrderStatus
  total_amount: number
  carrier: string | null
  tracking_number: string | null
  user_id: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  user_address: string | null
  order_name: string | null
  memo: string | null
  order_items: OrderItem[]
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const updateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setProcessing(orderId)
    const res = await fetch('/api/admin/update-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: nextStatus }),
    })
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: nextStatus } : o))
    } else {
      alert('상태 변경 중 오류가 발생했습니다.')
    }
    setProcessing(null)
  }

  const saveTracking = async (order: Order) => {
    const carrier = carrierInputs[order.id] ?? order.carrier ?? ''
    const tracking = trackingInputs[order.id] ?? order.tracking_number ?? ''
    setProcessing(order.id)
    const res = await fetch('/api/admin/update-order-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, carrier, tracking_number: tracking }),
    })
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, carrier, tracking_number: tracking } : o))
    } else {
      alert('송장 저장 중 오류가 발생했습니다.')
    }
    setProcessing(null)
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('order-files').createSignedUrl(filePath, 60)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = fileName
      a.click()
    }
  }

  const setQuickDate = (months: number) => {
    const to = new Date()
    const from = new Date()
    from.setMonth(from.getMonth() - months)
    setDateFrom(from.toISOString().slice(0, 10))
    setDateTo(to.toISOString().slice(0, 10))
  }

  const customerStats = useMemo(() => {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const stats: Record<string, { count: number; total: number }> = {}
    orders.forEach((o) => {
      if (!o.user_email) return
      if (new Date(o.created_at) >= oneYearAgo && o.status !== 'cancelled') {
        if (!stats[o.user_email]) stats[o.user_email] = { count: 0, total: 0 }
        stats[o.user_email].count += 1
        stats[o.user_email].total += o.total_amount
      }
    })
    return stats
  }, [orders])

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !search ||
      (o.user_name || '').toLowerCase().includes(q) ||
      (o.user_email || '').toLowerCase().includes(q) ||
      (o.user_phone || '').includes(q) ||
      o.id.includes(q)
    const orderDate = o.created_at.slice(0, 10)
    const matchDate = (!dateFrom || orderDate >= dateFrom) && (!dateTo || orderDate <= dateTo)
    return matchStatus && matchSearch && matchDate
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">주문 관리</h1>
        <button onClick={loadOrders} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center border border-gray-300 rounded-xl px-3 gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명, 연락처, 주문번호 검색"
              className="py-2.5 text-sm focus:outline-none w-52 text-black"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>전체</button>
            {(Object.entries(ORDER_STATUS_LABEL) as [OrderStatus, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setStatusFilter(key)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500">기간</span>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-2">
            {[{ label: '1개월', months: 1 }, { label: '3개월', months: 3 }, { label: '6개월', months: 6 }, { label: '1년', months: 12 }].map(({ label, months }) => (
              <button key={months} onClick={() => setQuickDate(months)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">{label}</button>
            ))}
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">초기화</button>
            )}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length}건</span>
        </div>
      </div>

      {/* 주문 목록 */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-5">
          {filtered.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

              {/* 상단 */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-xs text-gray-400 block">주문번호</span>
                    <span className="font-bold text-gray-800 text-sm">{order.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">주문일</span>
                    <span className="text-sm text-gray-700">{new Date(order.created_at).toLocaleDateString('ko-KR')}</span>
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
                        <span className="text-sm font-bold text-gray-700">{customerStats[order.user_email || '']?.count ?? 0}건</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <span className="text-xs text-gray-400 block">누적 주문금액</span>
                        <span className="text-sm font-bold text-gray-700">{(customerStats[order.user_email || '']?.total ?? 0).toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_COLOR[order.status]}`}>
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

                {/* 고객 정보 */}
                <div className="px-6 py-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">고객 정보</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">이름</span>
                      <span className="text-sm font-semibold text-gray-800">{order.user_name || '—'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">연락처</span>
                      <span className="text-sm text-gray-700">{order.user_phone || '—'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">이메일</span>
                      <span className="text-sm text-gray-700 break-all">{order.user_email || '—'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0">주소</span>
                      <span className="text-sm text-gray-700">{order.user_address || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 주문 상품 */}
                <div className="px-6 py-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 상품</p>
                  {order.order_items?.map((item, idx) => (
                    <div key={idx} className="space-y-2 mb-4 last:mb-0">
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">상품</span>
                        <span className="text-sm font-semibold text-gray-800">{item.product_id}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">수량</span>
                        <span className="text-sm text-gray-700">{item.quantity}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">컷팅</span>
                        <span className="text-sm text-gray-700">{item.cutting ? '있음' : '없음'}</span>
                      </div>
                      {item.due_date && (
                        <div className="flex gap-2">
                          <span className="text-xs text-gray-400 w-14 shrink-0">납기일</span>
                          <span className="text-sm text-gray-700">{item.due_date}</span>
                        </div>
                      )}
                      {item.request_note && (
                        <div className="flex gap-2">
                          <span className="text-xs text-gray-400 w-14 shrink-0">요청사항</span>
                          <span className="text-sm text-gray-700">{item.request_note}</span>
                        </div>
                      )}
                      {item.file_url && item.file_name && (
                        <button
                          onClick={() => downloadFile(item.file_url!, item.file_name!)}
                          className="flex items-center gap-1.5 mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {item.file_name}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 주문 처리 */}
                <div className="px-6 py-5">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 처리</p>
                  <div className="space-y-3">

                    {/* 다음 단계 버튼 */}
                    {NEXT_STATUS[order.status] && (
                      <button
                        disabled={processing === order.id}
                        onClick={async () => {
                          const next = NEXT_STATUS[order.status]!
                          if (confirm(`${ORDER_STATUS_LABEL[order.status]} → ${ORDER_STATUS_LABEL[next]} 으로 변경하시겠습니까?`)) {
                            await updateStatus(order.id, next)
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <ArrowRight className="w-4 h-4" />
                        {NEXT_STATUS_LABEL[order.status]}
                        <span className="text-blue-200 font-normal text-xs">({ORDER_STATUS_LABEL[NEXT_STATUS[order.status]!]})</span>
                      </button>
                    )}

                    {/* 무통장 입금 대기 확인 처리 */}
                    {order.status === 'pending' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-orange-700 mb-1">무통장 입금 대기</p>
                          <p className="text-sm text-gray-700 font-bold">{order.total_amount.toLocaleString()}원</p>
                          {order.memo && <p className="text-xs text-gray-500 mt-1">{order.memo}</p>}
                        </div>
                        <button
                          disabled={processing === order.id}
                          onClick={async () => {
                            if (confirm('입금을 확인하고 결제완료 처리하시겠습니까?')) {
                              await updateStatus(order.id, 'paid')
                            }
                          }}
                          className="w-full bg-orange-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                        >
                          입금 확인 완료 → 결제완료 처리
                        </button>
                      </div>
                    )}

                    {order.status === 'delivered' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-center">
                        <span className="text-sm text-green-600 font-bold">✓ 배송 완료</span>
                      </div>
                    )}

                    {order.status === 'cancelled' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-center">
                        <span className="text-sm text-red-500 font-medium">취소된 주문입니다</span>
                      </div>
                    )}

                    {order.status === 'refunded' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-center">
                        <span className="text-sm text-gray-500 font-medium">환불 완료된 주문입니다</span>
                      </div>
                    )}

                    {/* 환불 요청 처리 */}
                    {order.status === 'refund_requested' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-orange-700 mb-1">환불 요청 접수</p>
                          {(order as any).refund_reason && (
                            <p className="text-sm text-gray-700">사유: {(order as any).refund_reason}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={processing === order.id}
                            onClick={async () => {
                              if (confirm(`${order.user_name || '고객'}님의 환불을 승인하시겠습니까?\n\n※ 토스페이먼츠 대시보드에서 실제 환불을 진행해주세요.`)) {
                                await updateStatus(order.id, 'refunded')
                              }
                            }}
                            className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                          >
                            환불 승인
                          </button>
                          <button
                            disabled={processing === order.id}
                            onClick={async () => {
                              if (confirm('환불 요청을 거절하고 이전 상태로 되돌리시겠습니까?')) {
                                await updateStatus(order.id, 'paid')
                              }
                            }}
                            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            요청 거절
                          </button>
                        </div>
                        <p className="text-xs text-orange-600">※ 환불 승인 후 토스페이먼츠 대시보드에서 실제 환불을 처리해주세요.</p>
                      </div>
                    )}

                    {/* 주문 취소 - 결제완료 상태에서만 */}
                    {order.status === 'paid' && (
                      <button
                        disabled={processing === order.id}
                        onClick={async () => {
                          if (confirm(`${order.user_name || '고객'}님의 주문을 취소하시겠습니까?`)) {
                            await updateStatus(order.id, 'cancelled')
                          }
                        }}
                        className="w-full border border-red-300 text-red-500 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        주문 취소
                      </button>
                    )}

                    {/* 송장번호 */}
                    {(order.status === 'shipped' || order.status === 'delivered') && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">택배사 / 송장번호</label>
                        <div className="space-y-2">
                          <select
                            value={carrierInputs[order.id] ?? order.carrier ?? ''}
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
                            <option value="직접배송">직접배송</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              value={trackingInputs[order.id] ?? order.tracking_number ?? ''}
                              onChange={(e) => setTrackingInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                              placeholder="운송장 번호 입력"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <button
                              onClick={() => saveTracking(order)}
                              disabled={processing === order.id}
                              className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                              저장
                            </button>
                          </div>
                          {order.tracking_number && (
                            <p className="text-xs text-green-600">현재: {order.carrier} {order.tracking_number}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-400">주문이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}
