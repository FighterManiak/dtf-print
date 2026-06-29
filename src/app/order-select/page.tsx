import Link from 'next/link'
import { FileText, Zap } from 'lucide-react'

export default function OrderSelectPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">주문 방식 선택</h1>
        <p className="text-gray-500 mb-12">주문 방식을 선택해 주세요.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 견적 요청 */}
          <Link
            href="/quote/request"
            className="group flex flex-col items-center text-center p-8 bg-white border-2 border-gray-200 rounded-3xl hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
              <FileText className="w-8 h-8 text-gray-500 group-hover:text-blue-600 transition-colors" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">견적 요청</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              시안 파일을 업로드하면<br />
              출력 길이를 확인 후<br />
              견적을 보내드립니다.
            </p>
            <div className="mt-auto">
              <span className="inline-block bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
                롤 출력 · 수량 미확정
              </span>
            </div>
          </Link>

          {/* 바로 주문 */}
          <Link
            href="/order"
            className="group flex flex-col items-center text-center p-8 bg-white border-2 border-gray-200 rounded-3xl hover:border-gray-400 hover:shadow-lg transition-all"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-gray-200 transition-colors">
              <Zap className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">바로 주문</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              수량과 옵션을 직접 입력하고<br />
              즉시 결제까지<br />
              한번에 완료합니다.
            </p>
            <div className="mt-auto">
              <span className="inline-block bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full">
                A4 · A3 · 수량 확정 주문
              </span>
            </div>
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-10">
          롤 출력처럼 길이가 미정인 경우 <b>견적 요청</b>을 이용해 주세요.
        </p>
      </div>
    </div>
  )
}
