import GradeGuide from '@/components/ui/GradeGuide'
import { POINT_USE_THRESHOLD, POINT_EXPIRY_MONTHS } from '@/lib/grade'
import Link from 'next/link'

export const metadata = { title: '회원등급 안내 · SUPER HARD' }

export default function GradePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">회원등급 안내</h1>
      <p className="text-sm text-gray-700 mb-8">많이 이용하실수록 더 높은 등급과 포인트 적립 혜택을 드립니다.</p>

      <div className="mb-6">
        <GradeGuide />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 text-sm text-gray-900 leading-relaxed space-y-2">
        <p className="font-bold text-gray-900 mb-1">💜 포인트 혜택</p>
        <p>· 배송 완료 시 등급별 적립률에 따라 상품금액의 일정 비율이 포인트로 적립됩니다.</p>
        <p>· 적립 포인트는 <b>{POINT_USE_THRESHOLD.toLocaleString()}P 이상</b> 보유 시 주문에 사용할 수 있습니다.</p>
        <p>· 적립일로부터 <b>{POINT_EXPIRY_MONTHS}개월</b> 이내 사용해야 하며, 미사용 시 소멸됩니다.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-900 leading-relaxed space-y-2">
        <p className="font-bold text-gray-900 mb-1">등급 산정 기준</p>
        <p>· 매월 <b>전월 롤 출력(57cm) 사용 미터</b> 합계로 자동 산정됩니다.</p>
        <p>· 등급은 매월 갱신되며, 산정 대상은 롤 출력 상품 사용량입니다.</p>
        <p>· <b>DTF 장비 보유인증</b>과는 별개의 제도입니다.</p>
      </div>

      <div className="text-center mt-8">
        <Link href="/order" className="inline-block bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors">
          지금 주문하고 등급 올리기 →
        </Link>
      </div>
    </div>
  )
}
