'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

function QuoteSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const quoteId = searchParams.get('quoteId')

  useEffect(() => {
    const confirm = async () => {
      if (!quoteId) return
      const supabase = createClient()

      // 견적 정보 가져오기
      const { data: quote } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single()

      if (!quote) return

      // 이미 처리된 경우 중복 생성 방지
      if (quote.status === 'paid' && quote.order_id) return

      // orders 테이블에 주문 생성
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: quote.user_id,
        user_email: quote.user_email,
        user_name: quote.user_name,
        user_phone: quote.user_phone,
        user_address: quote.user_address,
        total_amount: quote.total_amount,
        status: 'paid',
        memo: `견적 주문 (${quote.product_type})${quote.admin_note ? ' · ' + quote.admin_note : ''}`,
      }).select('id').single()

      // quotes 상태 업데이트 + order_id 연결
      await supabase.from('quotes').update({
        status: 'paid',
        order_id: newOrder?.id || null,
      }).eq('id', quoteId)
    }
    confirm()
  }, [quoteId])

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-3">결제 완료!</h2>
      <p className="text-gray-500 mb-8">결제가 완료되었습니다. 빠르게 작업을 진행하겠습니다.</p>
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
