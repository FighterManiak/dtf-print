'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Download } from 'lucide-react'
import type { VerificationStatus } from '@/types'
import { createClient } from '@/lib/supabase-browser'

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: '심사 중', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',   icon: <Clock className="w-4 h-4" /> },
  approved: { label: '승인됨', color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: '반려됨', color: 'bg-red-50 text-red-600 ring-1 ring-red-200',           icon: <XCircle className="w-4 h-4" /> },
}

interface VerificationItem {
  id: string
  created_at: string
  user_email: string
  user_name: string
  user_id: string
  file_urls: string[]
  status: VerificationStatus
  reject_reason?: string
  reviewed_at?: string | null
  reviewed_by?: string | null
}

const TABS: { key: 'all' | VerificationStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '심사 중' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '반려됨' },
]

export default function VerificationsPage() {
  const [items, setItems] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | VerificationStatus>('all')

  useEffect(() => {
    loadVerifications()
  }, [])

  const loadVerifications = async () => {
    // RLS 우회를 위해 서비스롤 API로 조회 (브라우저 직접 조회 시 본인 신청만 보임)
    const res = await fetch('/api/admin/list-verifications')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  const getFileUrl = async (path: string) => {
    try {
      // RLS 우회를 위해 서비스롤 API로 서명 URL 발급
      const res = await fetch('/api/admin/verify-file-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert(e.error || '파일을 불러오지 못했습니다.')
        return
      }
      const { url } = await res.json()

      // 팝업 차단을 피하기 위해 blob으로 받아 직접 다운로드
      const fileRes = await fetch(url)
      if (!fileRes.ok) { alert('파일을 내려받지 못했습니다.'); return }
      const blob = await fileRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = path.split('/').pop() || 'verify-file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      alert('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  const process = async (item: VerificationItem, action: 'approve' | 'reject') => {
    if (action === 'reject' && !(rejectReason[item.id] || '').trim()) {
      alert('반려 사유를 입력해주세요.')
      return
    }
    setProcessing(item.id)
    const res = await fetch('/api/admin/process-verification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationId: item.id,
        userId: item.user_id,
        action,
        rejectReason: rejectReason[item.id] || '',
      }),
    })
    if (res.ok) await loadVerifications()
    else { const e = await res.json().catch(() => ({})); alert(e.error || '처리 실패') }
    setProcessing(null)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">DTF 인증 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">장비 보유 인증 신청 및 처리 이력 — 파일 확인 후 승인/반려 처리하세요.</p>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(({ key, label }) => {
          const cnt = key === 'all' ? items.length : items.filter((i) => i.status === key).length
          const isActive = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                isActive ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              {label}
              {cnt > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {items.filter((i) => tab === 'all' || i.status === tab).map((item) => {
          const cfg = STATUS_CONFIG[item.status]
          const isExpanded = expanded === item.id
          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-bold text-gray-900">{item.user_name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {item.user_email} · 신청 {new Date(item.created_at).toLocaleDateString('ko-KR')}
                      {item.reviewed_at && <span className="text-gray-400"> · 처리 {new Date(item.reviewed_at).toLocaleDateString('ko-KR')}</span>}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">첨부 파일</p>
                    <div className="flex flex-wrap gap-2">
                      {item.file_urls.map((url, idx) => (
                        <button key={idx} onClick={() => getFileUrl(url)}
                          className="flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 ring-1 ring-blue-200 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors font-semibold">
                          <Download className="w-4 h-4" />파일 {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.status === 'pending' && (
                    <div className="space-y-3">
                      <input
                        value={rejectReason[item.id] || ''}
                        onChange={(e) => setRejectReason((p) => ({ ...p, [item.id]: e.target.value }))}
                        placeholder="반려 사유 입력 (반려 시 회원에게 전달됩니다)"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => process(item, 'approve')} disabled={processing === item.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" />승인
                        </button>
                        <button onClick={() => process(item, 'reject')} disabled={processing === item.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                          <XCircle className="w-4 h-4" />반려
                        </button>
                      </div>
                    </div>
                  )}

                  {item.reject_reason && (
                    <div className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-4 py-3">
                      반려 사유: {item.reject_reason}
                    </div>
                  )}

                  {/* 처리 이력 */}
                  {item.status !== 'pending' && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm space-y-1">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">처리 이력</p>
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-gray-400">신청일</span>
                        <span className="text-gray-700">{new Date(item.created_at).toLocaleString('ko-KR')}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-gray-400">처리 결과</span>
                        <span className={`font-semibold ${item.status === 'approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.status === 'approved' ? '승인' : '반려'}
                        </span>
                      </div>
                      {item.reviewed_at && (
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 text-gray-400">처리일시</span>
                          <span className="text-gray-700">{new Date(item.reviewed_at).toLocaleString('ko-KR')}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-gray-400">처리자</span>
                        <span className="text-gray-700">{item.reviewed_by || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {items.filter((i) => tab === 'all' || i.status === tab).length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">해당하는 인증 내역이 없습니다.</div>
        )}
      </div>
    </div>
    </div>
  )
}
