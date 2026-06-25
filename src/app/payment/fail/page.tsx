'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'

function PaymentFailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const message = searchParams.get('message') || '결제가 취소되었습니다.'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-9 h-9 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">결제 실패</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button
          onClick={() => router.push('/order')}
          className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          다시 주문하기
        </button>
      </div>
    </div>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense>
      <PaymentFailContent />
    </Suspense>
  )
}
