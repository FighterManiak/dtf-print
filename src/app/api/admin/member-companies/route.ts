export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자: 회원 ID → 회사명 (주문 목록에 업체명 표시용)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const companies: Record<string, string> = {}
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    users.forEach((u) => {
      const c = String(u.user_metadata?.company || '').trim()
      if (c) companies[u.id] = c
    })
    if (users.length < perPage) break
  }

  return NextResponse.json({ companies })
}
