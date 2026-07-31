export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)

// 관리자: 이메일 발송 건수 통계 (오늘/이번 달/전체)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('email_logs')
    .select('created_at, sent_count')
    .order('created_at', { ascending: false })

  // 테이블이 없거나 오류면 통계 없음으로 처리
  if (error) return NextResponse.json({ available: false })

  const now = kstNow()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  let today = 0, month = 0, total = 0
  ;(data || []).forEach((r) => {
    const cnt = Number(r.sent_count) || 0
    total += cnt
    // created_at은 UTC 저장 → KST 기준 날짜로 비교
    const kstDate = new Date(new Date(r.created_at as string).getTime() + 9 * 3600 * 1000).toISOString()
    if (kstDate.slice(0, 10) === todayStr) today += cnt
    if (kstDate.slice(0, 7) === monthStr) month += cnt
  })

  return NextResponse.json({ available: true, today, month, total, campaigns: (data || []).length })
}
