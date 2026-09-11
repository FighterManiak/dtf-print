'use client'

import { useEffect, useState, useCallback } from 'react'
import { Mail, Search, Download, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { safeRows } from '@/lib/excel-safe'

interface MailLog {
  id: string
  created_at: string
  type: string | null
  subject: string | null
  scope: string | null
  sent_count: number | null
  sent_by: string | null
  recipient?: string | null
  body?: string | null
  ok?: boolean | null
}

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  broadcast: { label: '회원 발송', cls: 'bg-violet-100 text-violet-700' },
  test: { label: '테스트', cls: 'bg-gray-100 text-gray-500' },
  quote: { label: '견적 안내', cls: 'bg-blue-100 text-blue-700' },
  signup: { label: '가입 인증', cls: 'bg-emerald-100 text-emerald-700' },
  temp_password: { label: '임시 비번', cls: 'bg-amber-100 text-amber-700' },
  ordered: { label: '주문 접수', cls: 'bg-sky-100 text-sky-700' },
  payment_confirmed: { label: '입금 확인', cls: 'bg-sky-100 text-sky-700' },
  in_progress: { label: '작업 시작', cls: 'bg-indigo-100 text-indigo-700' },
  shipped: { label: '출고 알림', cls: 'bg-green-100 text-green-700' },
}

const TYPE_FILTERS = [
  { key: '', label: '전체' },
  { key: 'broadcast', label: '회원 발송' },
  { key: 'quote', label: '견적 안내' },
  { key: 'ordered', label: '주문 접수' },
  { key: 'shipped', label: '출고 알림' },
  { key: 'temp_password', label: '임시 비번' },
  { key: 'test', label: '테스트' },
]

const kst = (iso: string) =>
  new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')

// 저장된 본문이 HTML 메일인지 (회원 발송은 평문)
const isHtml = (s: string) => /^\s*</.test(s)

export default function MailHistoryPage() {
  const [logs, setLogs] = useState<MailLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const PAGE_SIZE = 50

  // 필터 변경 시 1페이지로 되돌리며 로딩 표시
  const applyFilter = useCallback((fn: () => void) => {
    fn()
    setPage(1)
    setLoading(true)
  }, [])

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE),
    })
    if (type) params.set('type', type)
    if (search) params.set('q', search)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)

    fetch(`/api/admin/mail-history?${params}`)
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d) => { if (alive) { setLogs(d.logs || []); setTotal(d.total || 0); setError('') } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [type, search, dateFrom, dateTo, page])

  const exportExcel = () => {
    if (logs.length === 0) { alert('내보낼 내역이 없습니다.'); return }
    const headers = ['발송일시', '유형', '제목', '수신', '건수', '발송자', '결과']
    const rows = logs.map((l) => [
      kst(l.created_at),
      TYPE_LABEL[l.type || '']?.label || l.type || '',
      l.subject || '',
      l.recipient || '',
      l.sent_count ?? 0,
      l.sent_by || '자동',
      l.ok === false ? '실패' : '성공',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...safeRows(rows)])
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 28 }, { wch: 8 }, { wch: 22 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '메일발송내역')
    XLSX.writeFile(wb, `메일발송내역_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-violet-500" />
            <h1 className="text-2xl font-bold text-gray-900">메일 발송 내역</h1>
          </div>
          <button onClick={exportExcel} disabled={logs.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">회원 발송·견적 안내·주문 알림 등 모든 발송 기록 — 총 {total.toLocaleString()}건</p>

        {/* 유형 필터 */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => applyFilter(() => setType(key))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${type === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 검색 + 기간 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[240px] shadow-sm">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(() => setSearch(q)) }}
              placeholder="제목 · 수신자 · 발송자 검색 후 Enter"
              className="flex-1 text-sm text-gray-900 focus:outline-none" />
            {q && <button onClick={() => applyFilter(() => { setQ(''); setSearch('') })} className="text-gray-300 hover:text-gray-500 text-xs">지우기</button>}
          </div>
          <input type="date" value={dateFrom} onChange={(e) => applyFilter(() => setDateFrom(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={(e) => applyFilter(() => setDateTo(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white" />
        </div>

        {error ? (
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-9 h-9 text-red-400 mx-auto mb-3" />
            <p className="text-gray-800 font-bold mb-1">조회할 수 없습니다</p>
            <p className="text-sm text-gray-500">{error}</p>
            <p className="text-xs text-gray-400 mt-3">supabase-email-logs.sql 을 먼저 실행했는지 확인해주세요.</p>
          </div>
        ) : loading ? (
          <p className="text-center py-20 text-gray-400 text-sm">불러오는 중...</p>
        ) : logs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-20">
            <p className="text-gray-400 text-sm">발송 내역이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {logs.map((l) => {
                const t = TYPE_LABEL[l.type || ''] || { label: l.type || '기타', cls: 'bg-gray-100 text-gray-500' }
                const open = expanded === l.id
                const hasBody = !!l.body
                return (
                  <div key={l.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className={`flex items-center gap-3 px-4 py-3 ${hasBody ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={() => hasBody && setExpanded(open ? null : l.id)}>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${t.cls}`}>{t.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.subject || '(제목 없음)'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {kst(l.created_at)}
                          {l.recipient && ` · ${l.recipient}`}
                          {l.sent_by && ` · ${l.sent_by}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-800">{(l.sent_count ?? 0).toLocaleString()}건</p>
                        {l.ok === false ? (
                          <p className="text-[10px] text-red-500 font-bold">일부 실패</p>
                        ) : hasBody ? (
                          <p className="text-[10px] text-violet-500 font-bold">{open ? '접기' : '내용 보기'}</p>
                        ) : (
                          <p className="text-[10px] text-gray-300">내용 없음</p>
                        )}
                      </div>
                      {hasBody && (open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />)}
                    </div>
                    {open && hasBody && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[11px] font-bold text-gray-500 mb-1.5">발송 내용</p>
                        {isHtml(l.body!) ? (
                          // 실제 발송된 메일 그대로 미리보기 (샌드박스로 격리)
                          <iframe
                            srcDoc={l.body!}
                            sandbox=""
                            title="메일 미리보기"
                            className="w-full h-[520px] bg-white border border-gray-200 rounded-lg"
                          />
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{l.body}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white disabled:opacity-40 hover:bg-gray-50">이전</button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white disabled:opacity-40 hover:bg-gray-50">다음</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
