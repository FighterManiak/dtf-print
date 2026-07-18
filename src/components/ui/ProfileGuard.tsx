'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'

// 전화번호 미등록 회원은 기본 정보 등록 화면으로 강제 이동
const EXEMPT_PREFIXES = ['/profile/setup', '/login', '/auth', '/terms', '/privacy', '/payment', '/reset-password']

export default function ProfileGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const phone = (u.user_metadata?.phone || '').replace(/[^0-9]/g, '')
      if (phone.length < 10) {
        router.replace(`/profile/setup?next=${encodeURIComponent(pathname)}`)
      }
    })
  }, [pathname])

  return null
}
