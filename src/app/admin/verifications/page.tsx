'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, Download } from 'lucide-react'
import type { VerificationStatus } from '@/types'

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '심사 중', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
  approved: { label: '승인됨', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: '반려됨', color: 'bg-red-100 text-red-600', icon: <XCircle className="w-4 h-4" /> },
}

// 예시 데이터 (Supabase 연동 전)
const SAMPLE = [
  {
    id: 'VER-001',
    created_at: '2024-01-15',
    user_email: 'hong@example.com',
    user_name: '홍길동',
    file_urls: ['장비사진.jpg', '구매영수증.pdf'],
    status: 'pending' as VerificationStatus,
  },
  {
    id: 'VER-002',
    created_at: '2024-01-14',
    user_email: 'kim@example.com',
    user_name: '김철수',
    file_urls: ['dtf_machine.jpg'],
    status: 'approved' as VerificationStatus,
  },
]

export default function VerificationsPage() {
  const [items, setItems] = useState(SAMPLE)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const approve = (id: string) => {
    setItems((prev) => prev.map((v) => v.id === id ? { ...v, status: 'approved' } : v))
    // TODO: Supabase - user_metadata.role = 'dtf_verified' 업데이트
  }

  const reject = (id: string) => {
    setItems((prev) => prev.map((v) => v.id === id ? { ...v, status: 'rejected' } : v))
    // TODO: Supabase - user_metadata.verify_status = 'rejected' 업데이트 + 사유 저장
  }

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
              {/* 요약 */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-bold text-gray-800">{item.user_name}</div>
                    <div className="text-sm text-gray-500">{item.user_email}</div>
                  </div>
                  <div className="text-sm text-gray-400">{item.created_at}</div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </div>
              </div>

              {/* 상세 */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                  {/* 첨부 파일 */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">첨부 파일</p>
                    <div className="flex flex-wrap gap-2">
                      {item.file_urls.map((url, idx) => (
                        <button
                          key={idx}
                          className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {url}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 승인/반려 (심사중일 때만) */}
                  {item.status === 'pending' && (
                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex gap-3">
                        <button
                          onClick={() => approve(item.id)}
                          className="flex items-center gap-2 bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          승인
                        </button>
                        <button
                          onClick={() => reject(item.id)}
                          className="flex items-center gap-2 bg-red-500 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-red-600 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          반려
                        </button>
                      </div>
                      <div>
                        <input
                          value={rejectReason[item.id] || ''}
                          onChange={(e) => setRejectReason((p) => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="반려 사유 입력 (반려 시 회원에게 전달됩니다)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
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
