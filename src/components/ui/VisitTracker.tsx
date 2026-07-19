'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// 페이지 이동마다 방문 기록 (관리자 페이지 제외)
export default function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer: document.referrer }),
    }).catch(() => {})
  }, [pathname])

  return null
}
