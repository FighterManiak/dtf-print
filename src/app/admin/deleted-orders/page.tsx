'use client'

import { useEffect, useState } from 'react'
import { Trash2, Search, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

interface DeletedRow {
  id: string
  deleted_at: string
  kind: string
  record_id: string
  user_name: string | null
  user_phone: string | null
  user_email: string | null
  total_amount: number | null
  status: string | null
  is_paid: boolean | null
  order_name: string | null
  memo: string | null
  original_created_at: string | null
  snapshot: unknown
  deleted_by: string | null
  deleted_by_role: string | null
  reason: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: '입금대기', quoted: '견적발송', bank_transfer_pending: '입금확인중',
  paid: '결제완료', in_progress: '작업중', shipped: '출고', delivered: '배송완료',
  cancelled: '취소', refunded: '환불', refund_requested: '환불요청',
}

export default function DeletedOrdersPage() {
  const [rows, setRows] = useState<DeletedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/deleted-orders')
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d) => setRows(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.user_name || '').toLowerCase().includes(q) ||
      (r.user_phone || '').includes(q) ||
      (r.user_email || '').toLowerCase().includes(q) ||
      (r.order_name || '').toLowerCase().includes(q) ||
      (r.deleted_by || '').toLowerCase().includes(q)
    )
  })

  // 입금완료 상태였는데 삭제된 건 = 특히 주의 필요
  const riskyCount = rows.filter((r) => r.is_paid !== false && ['paid', 'in_progress', 'shipped', 'delivered'].includes(r.status || '')).length
  const totalAmount = filtered.reduce((s, r) => s + (r.total_amount || 0), 0)

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-800 font-bold mb-1">열람 불가</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">삭제된 주문 내역</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">삭제된 주문·견적의 감사 기록입니다. 전체 관리자가 열람하며, 이 기록은 수정·삭제할 수 없습니다.</p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800 leading-relaxed">
          <b>🔒 삭제 기록 안내</b><br />
          주문을 삭제하면 <b>삭제한 관리자 계정·시각·사유</b>와 <b>금액·입금여부를 포함한 원본 전체</b>가 이 페이지에 영구 보관됩니다.
          특히 <b>결제완료 이후 삭제</b>된 건은 별도로 표시되어 정산 확인 대상이 됩니다.
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">총 삭제 건수</p>
            <p className="text-xl font-bold text-gray-900">{rows.length}건</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">삭제 금액 합계</p>
            <p className="text-xl font-bold text-gray-900">{totalAmount.toLocaleString()}원</p>
          </div>
          <div className={`rounded-xl p-4 border ${riskyCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-0.5">결제완료 이후 삭제</p>
            <p className={`text-xl font-bold ${riskyCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{riskyCount}건</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명, 연락처, 이메일, 주문명, 삭제한 관리자 검색"
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-400" />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16 text-gray-400 text-sm">삭제된 주문 내역이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const isOpen = expanded === r.id
              const risky = r.is_paid !== false && ['paid', 'in_progress', 'shipped', 'delivered'].includes(r.status || '')
              return (
                <div key={r.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${risky ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{r.user_name || r.user_email || '—'}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${r.kind === 'quote' ? 'bg-blue-50 text-blue-600 ring-blue-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                          {r.kind === 'quote' ? '견적주문' : '바로주문'}
                        </span>
                        {r.status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{STATUS_LABEL[r.status] || r.status}</span>}
                        {risky && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠️ 결제 이후 삭제</span>}
                        {r.is_paid === false && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">미입금</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                        {r.order_name && <span className="font-semibold text-gray-700">{r.order_name}</span>}
                        {r.total_amount != null && <span className="font-bold text-blue-600">{r.total_amount.toLocaleString()}원</span>}
                        {r.user_phone && <span>{r.user_phone}</span>}
                        <span>삭제: <b className="text-red-500">{r.deleted_by || '알 수 없음'}</b> ({r.deleted_by_role === 'superadmin' ? '최고관리자' : '관리자'})</span>
                        <span>{new Date(r.deleted_at).toLocaleString('ko-KR')}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-5 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-gray-500">주문 생성일</span><br /><span className="text-gray-800">{r.original_created_at ? new Date(r.original_created_at).toLocaleString('ko-KR') : '—'}</span></div>
                        <div><span className="text-gray-500">이메일</span><br /><span className="text-gray-800">{r.user_email || '—'}</span></div>
                      </div>
                      {r.memo && <div><span className="text-gray-500">메모</span><br /><span className="text-gray-800 whitespace-pre-wrap">{r.memo}</span></div>}
                      {r.reason && <div><span className="text-gray-500">삭제 사유</span><br /><span className="text-gray-800">{r.reason}</span></div>}
                      <details className="bg-gray-50 rounded-xl p-3">
                        <summary className="text-xs font-semibold text-gray-500 cursor-pointer">원본 데이터 전체 보기</summary>
                        <pre className="text-[11px] text-gray-600 mt-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(r.snapshot, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
