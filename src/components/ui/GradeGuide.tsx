import { GRADE_THRESHOLDS, POINT_RATES } from '@/lib/grade'

const GRADES: { key: 'vip' | 'gold' | 'silver' | 'normal'; label: string; badge: string; cond: string }[] = [
  { key: 'vip', label: 'VIP', badge: 'bg-purple-100 text-purple-700', cond: `전월 롤 출력 ${GRADE_THRESHOLDS.vip.toLocaleString()}m 이상` },
  { key: 'gold', label: 'GOLD', badge: 'bg-amber-100 text-amber-700', cond: `전월 롤 출력 ${GRADE_THRESHOLDS.gold.toLocaleString()}m 이상` },
  { key: 'silver', label: 'SILVER', badge: 'bg-slate-200 text-slate-700', cond: `전월 롤 출력 ${GRADE_THRESHOLDS.silver.toLocaleString()}m 이상` },
  { key: 'normal', label: '일반', badge: 'bg-gray-100 text-gray-500', cond: '그 외' },
]

// 회원등급 안내 표 (여러 페이지에서 재사용)
export default function GradeGuide({ currentGradeKey }: { currentGradeKey?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="font-bold text-gray-900 mb-1">회원 등급 안내</p>
      <p className="text-xs text-gray-700 mb-4">매달 <b>전월 롤 출력(57cm) 사용 미터</b> 합계로 자동 산정되며, 등급별 포인트 적립률이 다릅니다.</p>

      <div className="space-y-2">
        {GRADES.map((g) => {
          const rate = POINT_RATES[g.key]
          const isCurrent = currentGradeKey === g.key
          return (
            <div key={g.key}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 border ${isCurrent ? 'border-violet-300 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 w-16 text-center ${g.badge}`}>{g.label}</span>
              <span className="text-xs text-gray-800 flex-1">{g.cond}</span>
              <span className="text-sm font-bold shrink-0 text-right w-20">
                {rate > 0 ? <span className="text-violet-600">적립 {Math.round(rate * 100)}%</span> : <span className="text-gray-400">적립 없음</span>}
              </span>
              {isCurrent && <span className="text-[10px] font-bold text-violet-600 shrink-0">현재</span>}
            </div>
          )
        })}
      </div>

      <div className="mt-4 text-xs text-gray-600 leading-relaxed space-y-0.5">
        <p>· 롤 출력(57cm) 상품 사용량만 등급 산정에 반영됩니다.</p>
        <p>· 등급은 매월 갱신되며, DTF 장비 보유인증과는 별개입니다.</p>
      </div>
    </div>
  )
}
