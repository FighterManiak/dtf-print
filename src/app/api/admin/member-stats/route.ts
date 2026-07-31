export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)

// 관리자: 신규 가입 통계 (오늘/이번 달/전체)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const now = kstNow()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)
  const weekAgo = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10)
  const kstYmd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString()

  let today = 0, week = 0, month = 0, total = 0
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const users = data?.users || []
    users.forEach((u) => {
      if (!u.created_at) return
      // 탈퇴 회원 제외
      if (u.user_metadata?.withdrawn) return
      total += 1
      const d = kstYmd(u.created_at).slice(0, 10)
      if (d === todayStr) today += 1
      if (d >= weekAgo) week += 1
      if (kstYmd(u.created_at).slice(0, 7) === monthStr) month += 1
    })
    if (users.length < perPage) break
  }

  return NextResponse.json({ today, week, month, total })
}
