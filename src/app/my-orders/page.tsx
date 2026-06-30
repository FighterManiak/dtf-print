'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyOrdersRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/my-quotes') }, [])
  return null
}
