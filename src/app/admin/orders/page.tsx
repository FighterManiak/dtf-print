'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function AdminOrdersRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/quotes') }, [router])
  return null
}
