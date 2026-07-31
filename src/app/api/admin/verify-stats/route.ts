export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자: DTF 인증 신청 통계 (심사중 / 오늘신규 / 전체)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('dtf_verifications')
    .select('status, created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []

  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const pending = rows.filter((r) => r.status === 'pending').length
  const todayNew = rows.filter((r) => {
    const d = new Date(new Date(r.created_at as string).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    return d === todayStr
  }).length

  return NextResponse.json({ pending, todayNew, total: rows.length })
}
