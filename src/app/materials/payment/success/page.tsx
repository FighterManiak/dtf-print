'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

// 자재 카드결제 성공 → 서버에 승인 요청 후 주문 저장
function MaterialPaymentSuccessContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<'working' | 'done' | 'fail'>('working')
  const [message, setMessage] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // 개발 모드 이중 실행·새로고침에도 승인 요청은 한 번만
    if (started.current) return
    started.current = true

    const finish = (s: 'done' | 'fail', msg = '') => { setState(s); setMessage(msg) }

    const confirmOnce = async () => {
      await Promise.resolve() // 화면을 먼저 그린 뒤 처리

      const paymentKey = sp.get('paymentKey') || ''
      const orderId = sp.get('orderId') || ''
      const amount = Number(sp.get('amount'))
      const storeKey = `material_order_${sp.get('tossOrderId') || orderId}`

      let payload: Record<string, unknown> | null = null
      try { payload = JSON.parse(sessionStorage.getItem(storeKey) || 'null') } catch { payload = null }

      if (!paymentKey || !orderId || !Number.isFinite(amount)) {
        finish('fail', '결제 정보가 올바르지 않습니다. 결제는 완료되지 않았습니다.')
        return
      }
      if (!payload) {
        finish('fail', '주문 정보를 찾을 수 없어 결제를 완료하지 않았습니다. 같은 창에서 다시 주문해주세요. (결제 금액은 청구되지 않습니다)')
        return
      }
      setMaterialId(String(payload.materialId || '') || null)

      try {
        const r = await fetch('/api/materials/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, paymentMethod: 'CARD', paymentKey, tossOrderId: orderId, amount }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok) {
          sessionStorage.removeItem(storeKey)
          setTotal(typeof d.total === 'number' ? d.total : amount)
          finish('done')
        } else {
          finish('fail', d.error || '결제 승인에 실패했습니다.')
        }
      } catch {
        finish('fail', '네트워크 오류로 결제 확인을 마치지 못했습니다. 내 자재 주문에서 주문이 생성됐는지 확인해주세요.')
      }
    }

    void confirmOnce()
  }, [sp])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
        {state === 'working' && (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">결제 확인 중</h1>
            <p className="text-sm text-gray-500">창을 닫지 말고 잠시만 기다려주세요.</p>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">결제가 완료되었습니다</h1>
            {total != null && <p className="text-2xl font-bold text-gray-900 tabular-nums mb-1">{total.toLocaleString()}원</p>}
            <p className="text-sm text-gray-500 mb-6">주문이 접수됐습니다. 준비되는 대로 발송해드릴게요.</p>
            <div className="grid gap-2">
              <button onClick={() => router.push('/my-materials')}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">내 자재 주문 보기</button>
              <button onClick={() => router.push('/materials')}
                className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">계속 쇼핑하기</button>
            </div>
          </>
        )}

        {state === 'fail' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">결제를 완료하지 못했습니다</h1>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
            <button onClick={() => router.push(materialId ? `/materials/${materialId}` : '/materials')}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">다시 주문하기</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MaterialPaymentSuccessPage() {
  return <Suspense><MaterialPaymentSuccessContent /></Suspense>
}
