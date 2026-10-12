import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

// 관리자 API 공통 인증
// 로그인한 관리자(admin·superadmin)면 사용자 정보를, 아니면 null 을 돌려준다.
export async function getAdminUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  return role === 'admin' || role === 'superadmin' ? user : null
}

// 로그인한 사용자 (관리자 여부와 무관)
export async function getLoginUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const adminOnly = () =>
  NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 403 })
