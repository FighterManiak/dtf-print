export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fqjsdnmxaytuaanoqpfq.supabase.co'

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다')
  return createAdminClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

async function getCurrentRole(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user.user_metadata?.role || null
}

function isAdmin(role: string | null) {
  return role === 'admin' || role === 'superadmin'
}

function isSuperAdmin(role: string | null) {
  return role === 'superadmin'
}

export async function GET() {
  const role = await getCurrentRole()
  if (!isAdmin(role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const admin = getAdminClient()

  // listUsers는 페이지당 최대 인원이 제한되므로 전체 페이지를 순회
  const perPage = 1000
  const all: unknown[] = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all.push(...data.users)
    if (data.users.length < perPage) break
  }
  return NextResponse.json(all)
}

export async function PATCH(req: NextRequest) {
  const role = await getCurrentRole()
  if (!isSuperAdmin(role)) return NextResponse.json({ error: '최고 관리자만 권한을 변경할 수 있습니다' }, { status: 403 })
  const { userId, role: targetRole } = await req.json()
  const admin = getAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { role: targetRole }
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
