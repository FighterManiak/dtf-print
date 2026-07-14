'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Shield, ShieldCheck, User, X, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { resolveGrade } from '@/lib/grade'

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
    company?: string
    address?: string
    grade_override?: { grade?: string; until?: string } | null
  }
  app_metadata: {
    provider?: string
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  google: '구글', kakao: '카카오', naver: '네이버', email: '이메일',
}

interface ConfirmModal {
  memberId: string
  memberName: string
  targetRole: string
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [metersByUser, setMetersByUser] = useState<Record<string, number>>({})

  // 등급 수동 지정 모달
  const [gradeModal, setGradeModal] = useState<{ memberId: string; memberName: string } | null>(null)
  const [gradeSelect, setGradeSelect] = useState('vip')
  const [gradeUntil, setGradeUntil] = useState('')
  const [gradeSaving, setGradeSaving] = useState(false)

  const openGradeModal = (member: Member) => {
    const name = member.user_metadata?.full_name || member.user_metadata?.name || member.email
    const ov = member.user_metadata?.grade_override
    setGradeModal({ memberId: member.id, memberName: name })
    setGradeSelect(ov?.grade || 'vip')
    setGradeUntil(ov?.until || '')
  }

  const saveGrade = async (clear = false) => {
    if (!gradeModal) return
    if (!clear && !gradeUntil) { alert('적용 종료일을 지정해주세요.'); return }
    setGradeSaving(true)
    const res = await fetch('/api/admin/set-grade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: gradeModal.memberId, grade: clear ? 'clear' : gradeSelect, until: gradeUntil }),
    })
    if (res.ok) { setGradeModal(null); await loadMembers() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '저장 실패') }
    setGradeSaving(false)
  }

  // 비밀번호 확인 모달
  const [modal, setModal] = useState<ConfirmModal | null>(null)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const pwInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentRole(data.user?.user_metadata?.role || null)
    })
    fetch('/api/admin/member-grades').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.metersByUser) setMetersByUser(d.metersByUser) }).catch(() => {})
    loadMembers()
  }, [])

  useEffect(() => {
    if (modal) {
      setPassword('')
      setPwError('')
      setTimeout(() => pwInputRef.current?.focus(), 50)
    }
  }, [modal])

  const loadMembers = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/members')
    if (res.ok) setMembers(await res.json())
    else setError('회원 목록을 불러오지 못했습니다.')
    setLoading(false)
  }

  const openRoleModal = (member: Member, targetRole: string) => {
    const name = member.user_metadata?.full_name || member.user_metadata?.name || member.email
    setModal({ memberId: member.id, memberName: name, targetRole })
  }

  const confirmRoleChange = async () => {
    if (!modal || !password.trim()) { setPwError('비밀번호를 입력해주세요.'); return }
    setPwLoading(true)
    setPwError('')

    // 현재 로그인한 관리자 비밀번호 검증
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwError('로그인 정보를 확인할 수 없습니다.'); setPwLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password.trim(),
    })

    if (signInError) {
      setPwError('비밀번호가 올바르지 않습니다.')
      setPwLoading(false)
      return
    }

    // 비밀번호 확인 완료 → 권한 변경
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: modal.memberId, role: modal.targetRole }),
    })

    if (res.ok) {
      setModal(null)
      await loadMembers()
    } else {
      setPwError('권한 변경에 실패했습니다.')
    }
    setPwLoading(false)
    setProcessing(null)
  }

  const filtered = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.email.toLowerCase().includes(q) ||
      (m.user_metadata?.full_name || '').toLowerCase().includes(q) ||
      (m.user_metadata?.name || '').toLowerCase().includes(q) ||
      (m.user_metadata?.phone || '').includes(q) ||
      (m.user_metadata?.company || '').toLowerCase().includes(q) ||
      (m.user_metadata?.address || '').toLowerCase().includes(q)
    )
  })

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">전체 가입 회원 목록 — 총 {filtered.length}명</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 ring-1 ring-red-200 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일, 전화번호, 회사명, 주소 검색"
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-400" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="text-sm" style={{ minWidth: '1200px', width: '100%' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">이름</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-32">회사명</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-44">이메일</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-28">전화번호</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold w-48">주소</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">가입방법</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">가입일</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-24">등급 <span className="text-gray-400 font-normal">(전월)</span></th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">권한</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-20">DTF인증</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((member) => {
                const name = member.user_metadata?.full_name || member.user_metadata?.name || '-'
                const role = member.user_metadata?.role || 'user'
                const provider = member.app_metadata?.provider || 'email'
                const phone = member.user_metadata?.phone || '-'
                const company = member.user_metadata?.company || '-'
                const address = member.user_metadata?.address || '-'
                const isDtfVerified = role === 'dtf_verified' || member.user_metadata?.verify_status === 'approved'
                const isSuperAdmin = currentRole === 'superadmin'
                const meters = metersByUser[member.id] || 0
                const override = member.user_metadata?.grade_override as { grade?: string; until?: string } | undefined
                const { grade, isOverride } = resolveGrade(override, meters)
                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{company}</td>
                    <td className="px-4 py-4 text-gray-600">{member.email}</td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{phone}</td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{address}</td>
                    <td className="px-4 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs">
                        {PROVIDER_LABEL[provider] || provider}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500">
                      {new Date(member.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5 items-start">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold w-fit ${grade.color}`}>
                          {grade.label}{isOverride && <span className="text-[10px] font-normal opacity-70">지정</span>}
                        </span>
                        {isOverride && override?.until
                          ? <span className="text-xs text-gray-400">~{override.until}</span>
                          : <span className="text-xs text-gray-400">{meters.toLocaleString()}M</span>}
                        <button onClick={() => openGradeModal(member)} className="text-[11px] text-violet-600 hover:underline mt-0.5">등급 지정</button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {role === 'superadmin' ? (
                        <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-lg text-xs font-bold w-fit">
                          <ShieldCheck className="w-3 h-3" /> 최고관리자
                        </span>
                      ) : role === 'admin' ? (
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
                      {isDtfVerified ? (
                        <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-lg text-xs font-bold w-fit whitespace-nowrap">
                          <ShieldCheck className="w-3 h-3" /> 인증완료
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미인증</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isSuperAdmin ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {role !== 'superadmin' && (
                            <button onClick={() => openRoleModal(member, 'superadmin')} disabled={processing === member.id}
                              className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                              최고관리자
                            </button>
                          )}
                          {role !== 'admin' && role !== 'superadmin' && (
                            <button onClick={() => openRoleModal(member, 'admin')} disabled={processing === member.id}
                              className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">
                              관리자 지정
                            </button>
                          )}
                          {(role === 'admin' || role === 'superadmin') && (
                            <button onClick={() => openRoleModal(member, 'user')} disabled={processing === member.id}
                              className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                              권한 해제
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">열람만 가능</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">회원이 없습니다.</div>
          )}
        </div>
      </div>

      {/* 등급 수동 지정 모달 */}
      {gradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">등급 지정</h2>
              <button onClick={() => setGradeModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4"><b className="text-gray-900">{gradeModal.memberName}</b> 님의 등급을 기간 지정합니다.</p>

            <label className="text-xs font-semibold text-gray-600 block mb-1.5">등급</label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[['vip','VIP'],['gold','GOLD'],['silver','SILVER'],['normal','일반']].map(([k, label]) => (
                <button key={k} onClick={() => setGradeSelect(k)}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-colors ${gradeSelect===k ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold text-gray-600 block mb-1.5">적용 종료일 <span className="text-red-500">*</span></label>
            <input type="date" value={gradeUntil} min={new Date().toISOString().slice(0,10)} onChange={(e) => setGradeUntil(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <p className="text-xs text-gray-400 mb-5">이 날짜까지 지정 등급이 유지되고, 이후 자동 등급으로 돌아갑니다.</p>

            <div className="flex gap-2">
              <button onClick={() => saveGrade(true)} disabled={gradeSaving}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                지정 해제
              </button>
              <button onClick={() => saveGrade(false)} disabled={gradeSaving}
                className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                {gradeSaving ? '저장 중...' : '지정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 확인 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="font-bold text-gray-900">관리자 인증</h2>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold text-gray-900">{modal.memberName}</span> 님을{' '}
              <span className={`font-semibold ${modal.targetRole === 'superadmin' ? 'text-red-600' : modal.targetRole === 'admin' ? 'text-purple-600' : 'text-gray-600'}`}>
                {modal.targetRole === 'superadmin' ? '최고 관리자' : modal.targetRole === 'admin' ? '관리자' : '일반 회원'}
              </span>으로 변경합니다.
            </p>
            <p className="text-xs text-gray-400 mb-5">본인 계정 비밀번호를 입력해 확인해주세요.</p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">관리자 비밀번호</label>
              <input
                ref={pwInputRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError('') }}
                onKeyDown={(e) => e.key === 'Enter' && confirmRoleChange()}
                placeholder="비밀번호 입력"
                className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 ${pwError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {pwError && <p className="text-red-500 text-xs mt-1.5">{pwError}</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={confirmRoleChange} disabled={pwLoading || !password}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
                {pwLoading ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
