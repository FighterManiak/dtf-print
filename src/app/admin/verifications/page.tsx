'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Download } from 'lucide-react'
import type { VerificationStatus } from '@/types'
import { createClient } from '@/lib/supabase-browser'

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '심사 중', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
  approved: { label: '승인됨', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: '반려됨', color: 'bg-red-100 text-red-600', icon: <XCircle className="w-4 h-4" /> },
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

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">DTF 인증 요청 관리</h1>
      <p className="text-gray-500 text-sm mb-8">장비 보유 인증 신청 목록입니다. 첨부 파일 확인 후 승인/반려 처리해주세요.</p>

      <div className="space-y-4">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status]
          const isExpanded = expanded === item.id
          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-bold text-gray-800">{item.user_name}</div>
                    <div className="text-sm text-gray-500">{item.user_email}</div>
                  </div>
                  <div className="text-sm text-gray-400">{new Date(item.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">첨부 파일</p>
                    <div className="flex flex-wrap gap-2">
                      {item.file_urls.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => getFileUrl(url)}
                          className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          파일 {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.status === 'pending' && (
                    <div className="flex flex-col gap-3 pt-2">
                      <div>
                        <input
                          value={rejectReason[item.id] || ''}
                          onChange={(e) => setRejectReason((p) => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="반려 사유 입력 (반려 시 회원에게 전달됩니다)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => approve(item)}
                          disabled={processing === item.id}
                          className="flex items-center gap-2 bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          승인
                        </button>
                        <button
                          onClick={() => reject(item)}
                          disabled={processing === item.id}
                          className="flex items-center gap-2 bg-red-500 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          반려
                        </button>
                      </div>
                    </div>
                  )}

                  {item.reject_reason && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                      반려 사유: {item.reject_reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="text-center py-16 text-gray-400">인증 요청이 없습니다.</div>
        )}
      </div>
    </div>
  )
}
