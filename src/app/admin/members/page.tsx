'use client'

import { useState, useEffect } from 'react'
import { Search, Shield, ShieldCheck, User, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Member {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  user_metadata: {
    full_name?: string
    name?: string
    role?: string
    verify_status?: string
    phone?: string
    address?: string
  }
  app_metadata: {
    provider?: string
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  google: '구글',
  kakao: '카카오',
  naver: '네이버',
  email: '이메일',
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
    } else {
      setError('회원 목록을 불러오지 못했습니다.')
    }
    setLoading(false)
  }

  const setRole = async (userId: string, role: string) => {
    setProcessing(userId)
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    if (res.ok) await loadMembers()
    else setError('권한 변경에 실패했습니다.')
    setProcessing(null)
  }

  const filtered = members.filter((m) =>
    m.email.includes(search) ||
    (m.user_metadata?.full_name || '').includes(search) ||
    (m.user_metadata?.name || '').includes(search)
  )

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">회원 관리</h1>
      <p className="text-gray-500 text-sm mb-6">전체 가입 회원 목록입니다.</p>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일 또는 이름 검색"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="text-sm" style={{ minWidth: '900px', width: '100%' }}>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-24">이름</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-48">이메일</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-32">전화번호</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold w-56">주소</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">가입방법</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-24">가입일</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">권한</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-24">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((member) => {
              const name = member.user_metadata?.full_name || member.user_metadata?.name || '-'
              const role = member.user_metadata?.role || 'user'
              const provider = member.app_metadata?.provider || 'email'
              const phone = member.user_metadata?.phone || '-'
              const address = member.user_metadata?.address || '-'
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                  <td className="px-4 py-4 text-gray-600">{member.email}</td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{phone}</td>
                  <td className="px-4 py-4 text-gray-600">{address}</td>
                  <td className="px-4 py-4">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs">
                      {PROVIDER_LABEL[provider] || provider}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500">
                    {new Date(member.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-4">
                    {role === 'admin' ? (
                      <span className="flex items-center gap-1 text-purple-700 bg-purple-100 px-2 py-1 rounded-lg text-xs font-bold w-fit">
                        <Shield className="w-3 h-3" /> 관리자
                      </span>
                    ) : role === 'dtf_verified' ? (
                      <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-lg text-xs font-bold w-fit">
                        <ShieldCheck className="w-3 h-3" /> DTF인증
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded-lg text-xs w-fit">
                        <User className="w-3 h-3" /> 일반
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {role !== 'admin' && (
                        <button
                          onClick={() => setRole(member.id, 'admin')}
                          disabled={processing === member.id}
                          className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                        >
                          관리자 지정
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          onClick={() => setRole(member.id, 'user')}
                          disabled={processing === member.id}
                          className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          권한 해제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">회원이 없습니다.</div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">총 {filtered.length}명</p>
    </div>
  )
}
