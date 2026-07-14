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

async function getCurrentRole(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role || null
}

// 회원 등급 수동 지정/해제 (관리자 전용)
export async function POST(req: Request) {
  const role = await getCurrentRole()
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { userId, grade, until } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const admin = getAdminClient()

  // grade가 없거나 'clear'면 해제
  const override = (!grade || grade === 'clear')
    ? null
    : { grade, until: until || null }

  if (override && !override.until) {
    return NextResponse.json({ error: '적용 종료일을 지정해주세요.' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { grade_override: override },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, override })
}
