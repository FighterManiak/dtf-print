export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function currentRole(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role || null
}

// DTF 보유 인증 수동 승인/해제 (관리자 전용)
export async function POST(req: Request) {
  const role = await currentRole()
  if (role !== 'admin' && role !== 'superadmin') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { userId, approve } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { verify_status: approve ? 'approved' : null },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // dtf_verifications 테이블에도 반영 (있으면)
  await admin.from('dtf_verifications').update({ status: approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }).eq('user_id', userId)

  return NextResponse.json({ success: true })
}
