'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, User, ShieldCheck, Menu, X } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { getDemoSession, setDemoSession } from '@/lib/demo-auth'
import { useEffect, useRef, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { VerificationStatus } from '@/types'
import DtfVerifyModal from './DtfVerifyModal'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 페이지 이동 시 드롭다운/모바일 메뉴 닫기
  useEffect(() => {
    setMenuOpen(false)
    setMobileOpen(false)
  }, [pathname])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  useEffect(() => {
    const applyRole = (role: string | undefined) => {
      setIsAdmin(role === 'admin' || role === 'superadmin')
      setIsSuperAdmin(role === 'superadmin')
      if (role === 'dtf_verified') setVerifyStatus('approved')
      else setVerifyStatus(null)
    }

    if (!isSupabaseConfigured()) {
      const demo = getDemoSession()
      if (demo) {
        setUser({ id: demo.id, email: demo.email, user_metadata: demo.user_metadata } as unknown as SupabaseUser)
        applyRole(demo.user_metadata.role)
      }
      return
    }

    const supabase = createClient()

    const updateUserState = (u: SupabaseUser | null) => {
      setUser(u)
      applyRole(u?.user_metadata?.role)
      if (u?.user_metadata?.verify_status) setVerifyStatus(u.user_metadata.verify_status as VerificationStatus)
    }

    supabase.auth.getUser().then(({ data }) => updateUserState(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUserState(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    setMobileOpen(false)
    if (!isSupabaseConfigured()) {
      setDemoSession(null)
      window.location.href = '/'
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navItems = [
    { href: '/', label: '홈' },
    { href: '/order', label: '주문하기' },
    { href: '/my-quotes', label: '내 주문 현황' },
  ]

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자'

  const verifyBtnConfig = {
    null: { label: 'DTF 보유인증', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
    pending: { label: '인증 심사중', className: 'bg-yellow-400 hover:bg-yellow-500 text-white' },
    approved: { label: '✓ DTF 인증완료', className: 'bg-green-500 hover:bg-green-600 text-white' },
    rejected: { label: 'DTF 재신청', className: 'bg-red-500 hover:bg-red-600 text-white' },
  }
  const verifyBtn = verifyBtnConfig[verifyStatus ?? 'null'] ?? verifyBtnConfig['null']

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="shrink-0 font-[family-name:var(--font-barlow-condensed)] font-bold text-[1.8rem] tracking-tight text-gray-900 leading-none">
            SUPER HARD
          </Link>

          {/* 데스크탑 메뉴 */}
          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">
                관리자
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVerifyModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${verifyBtn.className}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {verifyBtn.label}
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    {displayName}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs text-gray-400">로그인 계정</p>
                        <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                        {verifyStatus === 'approved' && (
                          <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">DTF 인증 회원</span>
                        )}
                      </div>
                      <Link href="/my-quotes" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        내 주문 현황
                      </Link>
                      <Link href="/my-points" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100">
                        내 포인트
                      </Link>
                      <Link href="/profile/edit" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100">
                        회원정보 변경
                      </Link>
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100">
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link href="/login?tab=login" className="bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
                로그인
              </Link>
            )}
          </nav>

          {/* 모바일 햄버거 버튼 */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === item.href ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-50">
                관리자
              </Link>
            )}

            {user ? (
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-400">로그인 계정</p>
                  <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setVerifyModalOpen(true); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${verifyBtn.className}`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {verifyBtn.label}
                </button>
                <Link href="/my-points" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  내 포인트
                </Link>
                <Link href="/profile/edit" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  회원정보 변경
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50">
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-gray-100">
                <Link href="/login?tab=login" onClick={() => setMobileOpen(false)} className="block bg-gray-900 text-white text-center px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
                  로그인
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {verifyModalOpen && (
        <DtfVerifyModal
          onClose={() => setVerifyModalOpen(false)}
          currentStatus={verifyStatus}
        />
      )}
    </>
  )
}
