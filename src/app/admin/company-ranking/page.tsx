'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download, Trophy, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { safeRows } from '@/lib/excel-safe'

interface RankOrder { orderNo: string | null; date: string; amount: number; source: 'print' | 'material' }
interface RankRow {
  rank: number; key: string; label: string; hasCompany: boolean
  contact: string; phone: string
  orderCount: number; amount: number; printAmount: number; materialAmount: number
  share: number; prevRank: number | null; prevAmount: number
  orders: RankOrder[]
}
interface RankData {
  month: string; prevMonth: string; source: 'all' | 'print' | 'material'
  totals: { amount: number; orders: number; companies: number }
  prevTotals: { amount: number; companies: number }
  ranking: RankRow[]
}

const kstMonthNow = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7)
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${y}년 ${Number(m)}월` }
const won = (n: number) => `${Math.round(n).toLocaleString()}원`
const fmtPhone = (d: string) => d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d

// 전월 대비 증감률 (전월이 0이면 표시하지 않음)
const pctChange = (now: number, prev: number) => (prev > 0 ? (now - prev) / prev : null)

const SOURCES = [
  { key: 'all', label: '전체' },
  { key: 'print', label: '출력 주문' },
  { key: 'material', label: '자재 구매' },
] as const

export default function CompanyRankingPage() {
  const [month, setMonth] = useState(kstMonthNow())
  const [source, setSource] = useState<'all' | 'print' | 'material'>('all')
  const [data, setData] = useState<RankData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  // 조건이 바뀌면 로딩 표시 후 다시 조회
  const change = (fn: () => void) => { fn(); setLoading(true); setOpen(null) }

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/company-ranking?month=${month}&source=${source}`)
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d: RankData) => { if (alive) { setData(d); setError('') } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [month, source])

  const exportExcel = () => {
    if (!data || data.ranking.length === 0) return
    const headers = ['순위', '업체명', '담당자', '연락처', '주문건수', '주문금액', '출력', '자재', '비중(%)', '전월순위', '전월금액', '증감(%)']
    const rows = data.ranking.map((r) => {
      const ch = pctChange(r.amount, r.prevAmount)
      return [
        r.rank, r.label, r.contact || '', fmtPhone(r.phone || ''), r.orderCount, r.amount,
        r.printAmount, r.materialAmount, Math.round(r.share * 1000) / 10,
        r.prevRank ?? '신규', r.prevAmount, ch == null ? '' : Math.round(ch * 1000) / 10,
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([headers, ...safeRows(rows)])
    ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 13 }, { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, monthLabel(data.month))
    XLSX.writeFile(wb, `업체별주문순위_${data.month}.xlsx`)
  }

  const isFuture = month >= kstMonthNow()
  const totals = data?.totals
  const totalChange = data ? pctChange(data.totals.amount, data.prevTotals.amount) : null
  const top10Share = data ? data.ranking.slice(0, 10).reduce((s, r) => s + r.share, 0) : 0
  const maxAmount = data?.ranking[0]?.amount || 1

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-gray-900">업체별 주문 순위</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">월별 주문금액이 큰 업체 순서입니다. 결제가 확인된 주문만 집계합니다.</p>
          </div>
          <button onClick={exportExcel} disabled={!data || data.ranking.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </button>
        </div>

        {/* 조건 */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            <button onClick={() => change(() => setMonth((m) => shiftMonth(m, -1)))} aria-label="이전 달"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={month} max={kstMonthNow()}
              onChange={(e) => { if (e.target.value) change(() => setMonth(e.target.value)) }}
              className="text-sm font-bold text-gray-900 bg-transparent px-1 py-1 outline-none" />
            <button onClick={() => change(() => setMonth((m) => shiftMonth(m, 1)))} disabled={isFuture} aria-label="다음 달"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {SOURCES.map(({ key, label }) => (
              <button key={key} onClick={() => change(() => setSource(key))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${source === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{data ? monthLabel(data.month) : ''} 주문금액</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{totals ? won(totals.amount) : '—'}</p>
            {totalChange != null && (
              <p className={`text-xs font-semibold mt-0.5 ${totalChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                전월 대비 {totalChange >= 0 ? '+' : ''}{(totalChange * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">주문한 업체</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{totals ? `${totals.companies}곳` : '—'}</p>
            {data && <p className="text-xs text-gray-400 mt-0.5">주문 {totals?.orders.toLocaleString()}건 · 전월 {data.prevTotals.companies}곳</p>}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">상위 10곳 비중</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{data ? `${(top10Share * 100).toFixed(1)}%` : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">전체 주문금액 중</p>
          </div>
        </div>

        {/* 순위 */}
        {error ? (
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-9 h-9 text-red-400 mx-auto mb-3" />
            <p className="text-gray-800 font-bold mb-1">조회할 수 없습니다</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-center py-20 text-gray-400 text-sm">불러오는 중...</p>
        ) : !data || data.ranking.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16">
            <p className="text-gray-400 text-sm">{data ? monthLabel(data.month) : ''}에 결제된 주문이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* 열 제목 */}
            <div className="hidden sm:grid grid-cols-[56px_minmax(0,1fr)_64px_130px_120px_24px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
              <span>순위</span><span>업체</span><span className="text-right">건수</span><span className="text-right">주문금액</span><span className="text-right">전월</span><span />
            </div>

            {data.ranking.map((r) => {
              const isOpen = open === r.key
              const ch = pctChange(r.amount, r.prevAmount)
              const move = r.prevRank == null ? null : r.prevRank - r.rank
              return (
                <div key={r.key} className="border-b border-gray-100 last:border-0">
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.key)}
                    className="w-full text-left grid grid-cols-[44px_minmax(0,1fr)_24px] sm:grid-cols-[56px_minmax(0,1fr)_64px_130px_120px_24px] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                    {/* 순위 + 변동 */}
                    <div className="flex flex-col items-start">
                      <span className={`text-base font-bold tabular-nums ${r.rank <= 3 ? 'text-amber-600' : 'text-gray-900'}`}>{r.rank}</span>
                      <span className={`text-[10px] font-semibold ${move == null ? 'text-blue-500' : move > 0 ? 'text-emerald-600' : move < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                        {move == null ? 'NEW' : move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–'}
                      </span>
                    </div>

                    {/* 업체 + 비중 막대 */}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-bold text-gray-900 text-sm truncate">{r.label}</span>
                        {!r.hasCompany && <span className="text-[10px] text-gray-400 shrink-0">업체명 없음</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {[r.hasCompany ? r.contact : '', fmtPhone(r.phone || '')].filter(Boolean).join(' · ') || ' '}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-800 rounded-full" style={{ width: `${Math.max(2, (r.amount / maxAmount) * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums w-11 text-right">{(r.share * 100).toFixed(1)}%</span>
                      </div>
                      {/* 좁은 화면에서는 숫자를 업체 아래에 표시 */}
                      <div className="sm:hidden mt-1.5 flex items-center gap-2 text-xs">
                        <span className="font-bold text-gray-900 tabular-nums">{won(r.amount)}</span>
                        <span className="text-gray-400">{r.orderCount}건</span>
                        {ch != null && <span className={ch >= 0 ? 'text-emerald-600' : 'text-red-500'}>{ch >= 0 ? '+' : ''}{(ch * 100).toFixed(0)}%</span>}
                      </div>
                    </div>

                    <span className="hidden sm:block text-right text-sm text-gray-600 tabular-nums">{r.orderCount}건</span>
                    <span className="hidden sm:block text-right text-sm font-bold text-gray-900 tabular-nums">{won(r.amount)}</span>
                    <span className="hidden sm:block text-right text-xs tabular-nums">
                      {r.prevAmount > 0 ? (
                        <>
                          <span className="text-gray-400 block">{won(r.prevAmount)}</span>
                          {ch != null && <span className={`font-semibold ${ch >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{ch >= 0 ? '+' : ''}{(ch * 100).toFixed(0)}%</span>}
                        </>
                      ) : <span className="text-gray-300">전월 없음</span>}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {/* 이 업체의 해당 월 주문 */}
                  {isOpen && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 flex-wrap">
                        {r.printAmount > 0 && <span>출력 <b className="text-gray-800 tabular-nums">{won(r.printAmount)}</b></span>}
                        {r.materialAmount > 0 && <span>자재 <b className="text-gray-800 tabular-nums">{won(r.materialAmount)}</b></span>}
                        {r.orders.length < r.orderCount && <span>최근 {r.orders.length}건만 표시</span>}
                      </div>
                      <div className="grid gap-1">
                        {r.orders.map((o, i) => (
                          <div key={`${o.orderNo}-${i}`} className="flex items-center justify-between gap-3 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <span className="font-mono text-gray-600">{o.orderNo || '번호 없음'}</span>
                            <span className="text-gray-400">{o.date}</span>
                            <span className="text-gray-400">{o.source === 'material' ? '자재' : '출력'}</span>
                            <span className="font-semibold text-gray-900 tabular-nums ml-auto">{won(o.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 집계 기준 */}
        <div className="mt-5 text-xs text-gray-400 leading-relaxed space-y-0.5">
          <p>· 집계 대상: 결제완료 · 작업중 · 출고 · 배송완료 주문 (입금 대기, 취소, 환불, 후불 미입금 제외). 대시보드 매출과 같은 기준입니다.</p>
          <p>· 업체 구분: 회원정보의 회사명 → 전화주문에 입력한 업체명 순으로 묶습니다. 같은 회사의 여러 담당자 주문은 하나로 합칩니다. 업체명이 없으면 회원(또는 전화번호)별로 집계합니다.</p>
          <p>· 월 기준: 주문일(한국시간). 전월 순위와 비교해 ▲▼로 변동을 표시합니다.</p>
        </div>
      </div>
    </div>
  )
}
