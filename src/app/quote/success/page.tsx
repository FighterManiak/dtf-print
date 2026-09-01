'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, AlertTriangle } from 'lucide-react'

function QuoteSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const quoteId = searchParams.get('quoteId')
  // 토스가 전달하는 결제 정보
  const paymentKey = searchParams.get('paymentKey')
  const tossOrderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  const [state, setState] = useState<'loading' | 'done' | 'fail'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const confirm = async () => {
      if (!quoteId) { setState('fail'); setMessage('주문 정보를 찾을 수 없습니다.'); return }
      let delivery = null
      try {
        const raw = sessionStorage.getItem(`quoteDelivery_${quoteId}`)
        if (raw) delivery = JSON.parse(raw)
      } catch { /* 무시 */ }

      try {
        const res = await fetch('/api/quote/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId, delivery,
            paymentKey, orderId: tossOrderId,
            amount: amount ? Number(amount) : undefined,
          }),
        })
        const d = await res.json().catch(() => ({}))
        if (res.ok) {
          sessionStorage.removeItem(`quoteDelivery_${quoteId}`)
          setState('done')
        } else {
          setState('fail')
          setMessage(d.error || '결제 승인에 실패했습니다.')
        }
      } catch {
        setState('fail')
        setMessage('결제 처리 중 오류가 발생했습니다.')
      }
    }
    confirm()
  }, [quoteId, paymentKey, tossOrderId, amount])

  if (state === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
          <CheckCircle className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">결제 확인 중입니다</h2>
        <p className="text-gray-500 text-sm">잠시만 기다려주세요. 창을 닫지 마세요.</p>
      </div>
    )
  }

  if (state === 'fail') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">결제를 완료하지 못했습니다</h2>
        <p className="text-gray-500 mb-2 text-sm">{message}</p>
        <p className="text-gray-400 mb-8 text-xs">결제가 이루어지지 않았습니다. 다시 시도하시거나 문의해주세요.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push('/my-quotes')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
            내 주문 현황
          </button>
          <button onClick={() => router.push('/')}
            className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-3">결제 완료!</h2>
      <p className="text-gray-500 mb-8">결제가 정상적으로 완료되었습니다. 빠르게 작업을 진행하겠습니다.</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => router.push('/my-quotes')}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          견적 현황 확인
        </button>
        <button
          onClick={() => router.push('/')}
          className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          홈으로
        </button>
      </div>
    </div>
  )
}

export default function QuoteSuccessPage() {
  return <Suspense><QuoteSuccessContent /></Suspense>
}
