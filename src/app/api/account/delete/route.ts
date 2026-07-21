export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 회원 탈퇴 — 계정/정보는 보존하고 '탈퇴 상태'로 표시 (실제 삭제 안 함)
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  // 관리자 계정은 탈퇴 차단
  const role = user.user_metadata?.role
  if (role === 'admin' || role === 'superadmin') {
    return NextResponse.json({ error: '관리자 계정은 탈퇴할 수 없습니다.' }, { status: 400 })
  }

  // 회원 정보는 보존 — 메타데이터에 탈퇴 표시 + 재로그인 차단
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, withdrawn: true, withdrawn_at: new Date().toISOString() },
    ban_duration: '876000h', // 약 100년 — 사실상 영구 로그인 차단
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
