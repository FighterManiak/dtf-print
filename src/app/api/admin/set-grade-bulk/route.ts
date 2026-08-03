export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getAdminClient() {
  return createAdminClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 회원 등급 일괄 지정/해제 (관리자 전용)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { userIds, grade, until } = await req.json()
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: '대상 회원을 선택해주세요.' }, { status: 400 })
  }

  const override = (!grade || grade === 'clear') ? null : { grade, until: until || null }
  if (override && !override.until) {
    return NextResponse.json({ error: '적용 종료일을 지정해주세요.' }, { status: 400 })
  }

  const admin = getAdminClient()
  let done = 0
  const failed: string[] = []
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { grade_override: override },
    })
    if (error) failed.push(userId); else done += 1
  }

  return NextResponse.json({ success: true, count: done, failed: failed.length })
}
