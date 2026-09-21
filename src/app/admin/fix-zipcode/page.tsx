'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapPin, AlertTriangle, Wand2, Search } from 'lucide-react'
import { openPostcode } from '@/lib/daum-postcode'

interface Row {
  table: 'orders' | 'quotes'
  id: string
  order_no: string | null
  user_name: string | null
  user_phone: string | null
  address: string
  suggestZip: string
  suggestFrom: string
}

export default function FixZipcodePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [autoFixable, setAutoFixable] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [manual, setManual] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    fetch('/api/admin/fix-zipcode')
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d) => { setRows(d.rows || []); setAutoFixable(d.autoFixable || 0); setError('') })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/api/admin/fix-zipcode')
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d) => { if (alive) { setRows(d.rows || []); setAutoFixable(d.autoFixable || 0) } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // 추정된 우편번호 일괄 적용
  const autoFix = async () => {
    if (autoFixable === 0) { alert('자동으로 채울 수 있는 건이 없습니다.'); return }
    if (!confirm(`회원 정보·기존 주문 기록과 주소가 일치하는 ${autoFixable}건에 우편번호를 채웁니다.\n계속하시겠습니까?`)) return
    setRunning(true)
    const res = await fetch('/api/admin/fix-zipcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { alert(`${d.updated}건에 우편번호를 채웠습니다.`); setLoading(true); load() }
    else alert(d.error || '처리 실패')
    setRunning(false)
  }

  // 개별 주소를 검색해서 우편번호 지정
  const searchOne = async (r: Row) => {
    const result = await openPostcode()
    if (!result) return
    setManual((p) => ({ ...p, [r.id]: result.zonecode }))
  }

  const saveOne = async (r: Row) => {
    const zip = manual[r.id]
    if (!zip) return
    setRunning(true)
    const res = await fetch('/api/admin/fix-zipcode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ table: r.table, id: r.id, zip }] }),
    })
    if (res.ok) { setLoading(true); load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '저장 실패') }
    setRunning(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-800 font-bold mb-1">조회할 수 없습니다</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <MapPin className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">우편번호 정리</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          주소에 우편번호가 없는 주문입니다. 채워두면 엑셀 다운로드와 택배 발송에 그대로 쓸 수 있습니다.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">누락 건수</p>
            <p className="text-lg font-bold text-gray-900">{rows.length}건</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">자동 채우기 가능</p>
            <p className="text-lg font-bold text-emerald-600">{autoFixable}건</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">직접 확인 필요</p>
            <p className="text-lg font-bold text-amber-600">{rows.length - autoFixable}건</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16">
            <p className="text-gray-400 text-sm">모든 주문에 우편번호가 들어있습니다. 👍</p>
          </div>
        ) : (
          <>
            {autoFixable > 0 && (
              <button onClick={autoFix} disabled={running}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 mb-4">
                <Wand2 className="w-4 h-4" />
                {running ? '처리 중...' : `회원 정보·기존 기록으로 ${autoFixable}건 자동 채우기`}
              </button>
            )}

            <div className="space-y-2">
              {rows.map((r) => (
                <div key={`${r.table}-${r.id}`} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {r.order_no && <span className="text-xs font-mono font-bold text-gray-500">#{r.order_no}</span>}
                    <span className="text-sm font-bold text-gray-900">{r.user_name || '이름 없음'}</span>
                    {r.user_phone && <span className="text-xs text-gray-400">{r.user_phone}</span>}
                    {r.suggestZip && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        추정 {r.suggestZip} · {r.suggestFrom}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{r.address}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input value={manual[r.id] || ''} readOnly placeholder="우편번호"
                      className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-gray-50" />
                    <button onClick={() => searchOne(r)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800">
                      <Search className="w-3.5 h-3.5" /> 주소 검색
                    </button>
                    {manual[r.id] && (
                      <button onClick={() => saveOne(r)} disabled={running}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
                        저장
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
