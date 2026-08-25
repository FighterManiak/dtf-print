'use client'

import { useEffect, useState } from 'react'
import { X, Truck, ExternalLink, CheckCircle } from 'lucide-react'
import { trackingUrl } from '@/lib/tracking'

interface Step { time: string; where: string; kind: string; tel: string }
interface TrackResult {
  available: boolean
  reason?: string
  carrierName?: string | null
  invoice?: string
  completed?: boolean
  lastStatus?: string | null
  lastTime?: string | null
  steps?: Step[]
}

export default function TrackingModal({ carrier, invoice, onClose }: {
  carrier: string | null
  invoice: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TrackResult | null>(null)

  useEffect(() => {
    fetch(`/api/tracking?carrier=${encodeURIComponent(carrier || '')}&invoice=${encodeURIComponent(invoice)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ available: false, reason: '조회 중 오류가 발생했습니다.' }))
      .finally(() => setLoading(false))
  }, [carrier, invoice])

  const external = trackingUrl(carrier, invoice)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-gray-900">배송 조회</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* 송장 정보 */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{data?.carrierName || carrier || '택배사'}</span>
            <span className="font-bold text-gray-800 tracking-wider">{invoice}</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-5">
          {loading ? (
            <p className="text-center py-10 text-gray-400 text-sm">조회 중...</p>
          ) : data?.available ? (
            <>
              {/* 현재 상태 */}
              <div className={`rounded-xl px-4 py-3 mb-4 ${data.completed ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                <div className="flex items-center gap-2">
                  {data.completed && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                  <span className={`font-bold text-sm ${data.completed ? 'text-green-700' : 'text-purple-700'}`}>
                    {data.completed ? '배송 완료' : data.lastStatus || '배송 중'}
                  </span>
                </div>
                {data.lastTime && <p className="text-xs text-gray-500 mt-0.5">{data.lastTime}</p>}
              </div>

              {/* 배송 단계 */}
              {data.steps && data.steps.length > 0 ? (
                <div className="space-y-0">
                  {data.steps.map((s, i) => {
                    const isLast = i === data.steps!.length - 1
                    return (
                      <div key={i} className="flex gap-3">
                        {/* 타임라인 */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${isLast ? 'bg-purple-600 ring-4 ring-purple-100' : 'bg-gray-300'}`} />
                          {i < data.steps!.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                        </div>
                        <div className={`pb-4 min-w-0 ${isLast ? '' : 'opacity-70'}`}>
                          <p className={`text-sm font-semibold ${isLast ? 'text-purple-700' : 'text-gray-700'}`}>{s.kind}</p>
                          <p className="text-xs text-gray-500">{s.where}{s.tel ? ` · ${s.tel}` : ''}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{s.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center py-6 text-gray-400 text-sm">아직 배송 정보가 없습니다.</p>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-1">{data?.reason || '배송 정보를 불러올 수 없습니다.'}</p>
              <p className="text-gray-400 text-xs">택배사 사이트에서 직접 확인해보세요.</p>
            </div>
          )}
        </div>

        {/* 하단 */}
        <div className="p-4 border-t border-gray-100 shrink-0 space-y-2">
          {external && (
            <a href={external} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              <ExternalLink className="w-4 h-4" /> 택배사 사이트에서 보기
            </a>
          )}
          <button onClick={onClose} className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800">닫기</button>
        </div>
      </div>
    </div>
  )
}
