export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 최고관리자: 회원 탈퇴 처리 / 복구
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 처리할 수 있습니다.' }, { status: 403 })
  }

  const { userId, withdraw } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const admin = getAdminClient()
  const { data: target } = await admin.auth.admin.getUserById(userId)
  const targetRole = target.user?.user_metadata?.role
  if (targetRole === 'admin' || targetRole === 'superadmin') {
    return NextResponse.json({ error: '관리자 계정은 탈퇴 처리할 수 없습니다.' }, { status: 400 })
  }

  const meta = target.user?.user_metadata || {}

  if (withdraw) {
    // 탈퇴 처리 — 정보 보존 + 로그인 차단
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, withdrawn: true, withdrawn_at: new Date().toISOString() },
      ban_duration: '876000h',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // 복구 — 탈퇴 표시 해제 + 로그인 차단 해제
    const newMeta = { ...meta }
    delete newMeta.withdrawn
    delete newMeta.withdrawn_at
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: newMeta,
      ban_duration: 'none',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
