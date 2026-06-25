'use client'

import { useState, useEffect } from 'react'
import { Download, ChevronDown, ChevronUp, Package, Calendar } from 'lucide-react'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types'
import { createClient } from '@/lib/supabase-browser'

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
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
  user_name: string | null
  user_phone: string | null
  user_address: string | null
  order_items: OrderItem[]
}

const today = new Date()
const formatDate = (d: Date) => d.toISOString().slice(0, 10)
const monthAgo = new Date(today)
monthAgo.setMonth(monthAgo.getMonth() - 1)

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(formatDate(monthAgo))
  const [dateTo, setDateTo] = useState(formatDate(today))
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setLoading(false); return }
    setUser({ email: user.email || '' })
    await loadOrders(user.id)
  }

  const loadOrders = async (userId?: string) => {
    setLoading(true)
    setError('')
    const supabase = createClient()

    let uid = userId
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('로그인이 필요합니다.'); setLoading(false); return }
      uid = user.id
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', uid)
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })

    if (error) { setError('주문 내역을 불러오지 못했습니다.'); }
    else setOrders(data || [])
    setLoading(false)
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

  const setQuickRange = (days: number) => {
    const from = new Date()
    from.setDate(from.getDate() - days)
    setDateFrom(formatDate(from))
    setDateTo(formatDate(today))
  }

  if (!user && !loading && error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">로그인 후 주문 내역을 확인할 수 있습니다.</p>
        <a href="/login" className="mt-4 inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors">
          로그인하기
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">내 주문 내역</h1>
      {user && <p className="text-sm text-gray-500 mb-6">{user.email}</p>}

      {/* 기간 검색 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => loadOrders()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            조회
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ label: '1개월', days: 30 }, { label: '3개월', days: 90 }, { label: '6개월', days: 180 }, { label: '1년', days: 365 }].map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setQuickRange(days)}
              className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-400">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p>해당 기간에 주문 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expanded === order.id
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* 요약 */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800 text-sm">{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(order.created_at).toLocaleDateString('ko-KR')}</span>
                      <span>·</span>
                      <span className="font-semibold text-blue-600">{order.total_amount.toLocaleString()}원</span>
                      <span>·</span>
                      <span>{order.order_items?.length || 0}개 상품</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {/* 상세 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 space-y-5">
                    {/* 배송 정보 */}
                    {(order.carrier || order.tracking_number) && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-purple-700 mb-2">배송 정보</p>
                        <div className="flex items-center gap-3 text-sm text-purple-800">
                          {order.carrier && <span>{order.carrier}</span>}
                          {order.tracking_number && (
                            <span className="font-bold">{order.tracking_number}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 주문 상품 목록 */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 mb-3">주문 상품</p>
                      <div className="space-y-4">
                        {order.order_items?.map((item, idx) => (
                          <div key={item.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold text-gray-800 text-sm">{item.product_id}</span>
                              <span className="text-sm font-bold text-blue-600">{item.unit_price.toLocaleString()}원</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span>수량: <b className="text-gray-700">{item.quantity}</b></span>
                              <span>컷팅: <b className="text-gray-700">{item.cutting ? `있음 (+${item.cutting_price.toLocaleString()}원)` : '없음'}</b></span>
                              {item.due_date && <span>납기일: <b className="text-gray-700">{item.due_date}</b></span>}
                              {item.request_note && <span className="col-span-2">요청사항: <b className="text-gray-700">{item.request_note}</b></span>}
                            </div>
                            {item.file_url && item.file_name && (
                              <button
                                onClick={() => downloadFile(item.file_url!, item.file_name!)}
                                className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors mt-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {item.file_name}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 배송지 */}
                    {order.user_address && (
                      <div className="text-xs text-gray-500 border-t border-gray-100 pt-4">
                        <span className="font-semibold text-gray-600">배송지: </span>{order.user_address}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 text-center pt-2">총 {orders.length}건</p>
        </div>
      )}
    </div>
  )
}
