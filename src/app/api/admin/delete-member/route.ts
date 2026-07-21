export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 최고관리자: 회원 완전 삭제 (계정 삭제)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 })

  const admin = getAdminClient()
  const { data: target } = await admin.auth.admin.getUserById(userId)
  const targetRole = target.user?.user_metadata?.role
  if (targetRole === 'admin' || targetRole === 'superadmin') {
    return NextResponse.json({ error: '관리자 계정은 삭제할 수 없습니다.' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
