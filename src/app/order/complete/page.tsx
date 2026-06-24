import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function OrderCompletePage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">주문이 완료되었습니다!</h1>
      <p className="text-gray-500 mb-8">
        입력하신 이메일로 주문 확인 메일을 발송했습니다.<br />
        작업이 시작되면 별도로 안내드립니다.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/my-orders"
          className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          주문 조회
        </Link>
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
