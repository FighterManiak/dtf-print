'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { demoLogin, setDemoSession, DEMO_USERS } from '@/lib/demo-auth'
import { Printer, Eye, EyeOff, FlaskConical } from 'lucide-react'
import { Suspense, useState, useEffect } from 'react'

type Tab = 'social' | 'login' | 'signup'

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/'

  const [tab, setTab] = useState<Tab>('social')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 추천인 링크(?ref=코드)로 진입 시 저장 → 가입 정보 등록 화면에서 자동 입력
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) localStorage.setItem('referral_code', ref.toUpperCase().trim())
  }, [])

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    addressDetail: '',
    password: '',
    passwordConfirm: '',
  })

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) { setError('Supabase가 설정되지 않았습니다.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${redirect}` },
    })
    if (error) { setError('구글 로그인 실패: ' + error.message); setLoading(false) }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Supabase 미연동 시 데모 로그인
    if (!isSupabaseConfigured()) {
      const demoUser = demoLogin(loginForm.email, loginForm.password)
      setLoading(false)
      if (!demoUser) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        return
      }
      setDemoSession(demoUser)
      window.location.href = redirect  // 강제 새로고침으로 헤더 상태 반영
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    })
    setLoading(false)
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    router.push(redirect)
    router.refresh()
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (signupForm.password !== signupForm.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (signupForm.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!signupForm.phone.trim()) {
      setError('연락처를 입력해주세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
      options: {
        data: {
          full_name: signupForm.name,
          phone: signupForm.phone,
          address: signupForm.address,
          address_detail: signupForm.addressDetail,
        },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message === 'User already registered' ? '이미 가입된 이메일입니다.' : '회원가입 중 오류가 발생했습니다.')
      return
    }
    setSuccess('가입 확인 이메일을 발송했습니다. 이메일을 확인해주세요.')
  }

  const handleForgotPassword = async () => {
    if (!loginForm.email) {
      setError('이메일을 먼저 입력해주세요.')
      return
    }
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(loginForm.email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    })
    setSuccess('비밀번호 재설정 링크를 이메일로 발송했습니다.')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
        {/* 로고 */}
        <div className="text-center pt-8 pb-4 px-8">
          <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-xl mb-1">
            <Printer className="w-6 h-6" />
            DTF 출력 서비스
          </div>
          <p className="text-gray-500 text-sm">로그인하고 주문을 시작하세요</p>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100 mx-6">
          {([
            { key: 'social', label: '간편 로그인' },
            { key: 'login', label: '이메일 로그인' },
            { key: 'signup', label: '회원가입' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setSuccess('') }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 에러/성공 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">
              {success}
            </div>
          )}

          {/* 간편 로그인 탭 */}
          {tab === 'social' && (
            <div className="space-y-3">
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-bold py-3.5 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <GoogleIcon />
                구글로 시작하기
              </button>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                onClick={() => setTab('login')}
                className="w-full py-3 border border-gray-300 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                이메일로 로그인
              </button>
              <button
                onClick={() => setTab('signup')}
                className="w-full py-3 text-sm text-blue-600 font-medium hover:underline"
              >
                아직 계정이 없으신가요? 회원가입
              </button>
            </div>
          )}

          {/* 데모 계정 빠른 로그인 (Supabase 미연동 시만 표시) */}
          {!isSupabaseConfigured() && tab === 'login' && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-amber-700 font-bold text-sm mb-3">
                <FlaskConical className="w-4 h-4" />
                테스트 계정 (개발용)
              </div>
              <div className="space-y-2">
                {[
                  { label: '관리자', user: DEMO_USERS.admin, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
                  { label: 'DTF 인증 고객', user: DEMO_USERS.verified, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
                  { label: '일반 고객', user: DEMO_USERS.normal, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                ].map(({ label, user, color }) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => setLoginForm({ email: user.email, password: user.password })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${color}`}
                  >
                    <span className="font-bold">[{label}]</span> {user.email} / {user.password}
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">* 버튼 클릭 시 자동 입력됩니다</p>
            </div>
          )}

          {/* 이메일 로그인 탭 */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이메일</label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="비밀번호 입력"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400 pr-11"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-blue-500 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <p className="text-center text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <button type="button" onClick={() => setTab('signup')} className="text-blue-600 font-medium hover:underline">
                  회원가입
                </button>
              </p>
            </form>
          )}

          {/* 회원가입 탭 */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이름</label>
                <input
                  type="text"
                  required
                  value={signupForm.name}
                  onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이메일</label>
                <input
                  type="email"
                  required
                  value={signupForm.email}
                  onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  기본 배송지 주소 <span className="text-gray-400 font-normal text-xs">(선택)</span>
                </label>
                <input
                  type="text"
                  value={signupForm.address}
                  onChange={(e) => setSignupForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="서울시 강남구 테헤란로 123"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                />
                <input
                  type="text"
                  value={signupForm.addressDetail}
                  onChange={(e) => setSignupForm((p) => ({ ...p, addressDetail: e.target.value }))}
                  placeholder="상세주소 (동/호수 등)"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">비밀번호 <span className="text-gray-400 font-normal">(8자 이상)</span></label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={signupForm.password}
                    onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="8자 이상 입력"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400 pr-11"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showPwConfirm ? 'text' : 'password'}
                    required
                    value={signupForm.passwordConfirm}
                    onChange={(e) => setSignupForm((p) => ({ ...p, passwordConfirm: e.target.value }))}
                    placeholder="비밀번호 재입력"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400 pr-11"
                  />
                  <button type="button" onClick={() => setShowPwConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '가입 중...' : '회원가입'}
              </button>
              <p className="text-center text-sm text-gray-500">
                이미 계정이 있으신가요?{' '}
                <button type="button" onClick={() => setTab('login')} className="text-blue-600 font-medium hover:underline">
                  로그인
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-6 px-8">
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
