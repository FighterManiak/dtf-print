'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'

// 자재 카드결제 실패·취소 (토스가 code·message 를 붙여서 보냄)
function MaterialPaymentFailContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const code = sp.get('code') || ''
  const canceled = /PAY_PROCESS_CANCELED|PAYMENT_CANCELED|USER_CANCEL/i.test(code)
  const message = canceled ? '결제를 취소했습니다.' : (sp.get('message') || '결제가 완료되지 않았습니다.')
  const materialId = sp.get('materialId')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-9 h-9 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{canceled ? '결제 취소' : '결제 실패'}</h1>
        <p className="text-sm text-gray-500 mb-1">{message}</p>
        <p className="text-xs text-gray-400 mb-6">결제 금액은 청구되지 않았습니다.</p>
        <button onClick={() => router.push(materialId ? `/materials/${materialId}` : '/materials')}
          className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">
          다시 주문하기
        </button>
      </div>
    </div>
  )
}

export default function MaterialPaymentFailPage() {
  return <Suspense><MaterialPaymentFailContent /></Suspense>
}
