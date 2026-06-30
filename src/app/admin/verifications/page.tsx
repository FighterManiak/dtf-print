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
}

export default function VerificationsPage() {
  const [items, setItems] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadVerifications()
  }, [])

  const loadVerifications = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('dtf_verifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setItems(data)
    setLoading(false)
  }

  const getFileUrl = async (path: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('verify-files').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const approve = async (item: VerificationItem) => {
    setProcessing(item.id)
    const supabase = createClient()
    await supabase.from('dtf_verifications').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', item.id)
    // 사용자 메타데이터 업데이트 (서버 액션 필요 - 일단 DB만 업데이트)
    await loadVerifications()
    setProcessing(null)
  }

  const reject = async (item: VerificationItem) => {
    setProcessing(item.id)
    const supabase = createClient()
    await supabase.from('dtf_verifications').update({
      status: 'rejected',
      reject_reason: rejectReason[item.id] || '',
      reviewed_at: new Date().toISOString(),
    }).eq('id', item.id)
    await loadVerifications()
    setProcessing(null)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">DTF 인증 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">장비 보유 인증 신청 목록 — 파일 확인 후 승인/반려 처리하세요.</p>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
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
                    <div className="text-sm text-gray-500 mt-0.5">{item.user_email} · {new Date(item.created_at).toLocaleDateString('ko-KR')}</div>
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
                        <button onClick={() => approve(item)} disabled={processing === item.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" />승인
                        </button>
                        <button onClick={() => reject(item)} disabled={processing === item.id}
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
                </div>
              )}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">인증 요청이 없습니다.</div>
        )}
      </div>
    </div>
    </div>
  )
}
