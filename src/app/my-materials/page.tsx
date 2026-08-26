'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import TrackingModal from '@/components/ui/TrackingModal'

interface MaterialOrder {
  id: string; created_at: string; order_no: string | null; order_name: string | null
  items: { materialId: string; name: string; price: number; qty: number }[]
  product_amount: number; shipping_fee: number; used_points: number; total_amount: number
  status: string; payment_method: string | null
  carrier: string | null; tracking_number: string | null
  user_address: string | null
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '입금 대기', color: 'bg-orange-100 text-orange-700' },
  paid: { label: '결제 완료', color: 'bg-green-100 text-green-700' },
  in_progress: { label: '준비 중', color: 'bg-blue-100 text-blue-700' },
  shipped: { label: '출고', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: '배송 완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-gray-100 text-gray-500' },
}

export default function MyMaterialsPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack] = useState<{ carrier: string | null; invoice: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/my-materials'); return }
      const res = await fetch('/api/materials/order')
      if (res.ok) setOrders(await res.json())
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">자재 구매 내역</h1>
        <Link href="/materials" className="text-sm font-semibold text-blue-600 hover:underline">자재 구매하러 가기 →</Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl text-center py-16">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">구매 내역이 없습니다.</p>
          <Link href="/materials" className="text-blue-600 font-semibold text-sm hover:underline">자재 둘러보기</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = STATUS[o.status] || STATUS.pending
            return (
              <div key={o.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
                  {o.order_no && <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{o.order_no}</span>}
                  <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('ko-KR')}</span>
                  {o.payment_method === 'bank_transfer' && <span className="text-xs text-orange-600 font-semibold">무통장</span>}
                </div>

                <p className="font-bold text-gray-900 mb-2">{o.order_name}</p>

                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{it.name} × {it.qty}</span>
                      <span>{(it.price * it.qty).toLocaleString()}원</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500"><span>배송비</span><span>{o.shipping_fee === 0 ? '무료' : `${o.shipping_fee.toLocaleString()}원`}</span></div>
                  {o.used_points > 0 && (
                    <div className="flex justify-between text-violet-600"><span>포인트 사용</span><span>-{o.used_points.toLocaleString()}원</span></div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900"><span>결제 금액</span><span className="text-blue-600">{o.total_amount.toLocaleString()}원</span></div>
                </div>

                {o.tracking_number && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">{o.carrier}</span>
                      <span className="font-bold text-purple-700 tracking-wider">{o.tracking_number}</span>
                    </div>
                    <button onClick={() => setTrack({ carrier: o.carrier, invoice: o.tracking_number! })}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700">
                      <Truck className="w-4 h-4" /> 배송 조회하기
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {track && <TrackingModal carrier={track.carrier} invoice={track.invoice} onClose={() => setTrack(null)} />}
    </div>
  )
}
