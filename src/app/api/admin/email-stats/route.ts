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

  const now = kstNow()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)
  const kstYmd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString()

  type Bucket = { today: number; month: number; total: number }
  const empty = (): Bucket => ({ today: 0, month: 0, total: 0 })
  const add = (b: Bucket, iso: string, cnt: number) => {
    const d = kstYmd(iso)
    b.total += cnt
    if (d.slice(0, 10) === todayStr) b.today += cnt
    if (d.slice(0, 7) === monthStr) b.month += cnt
  }

  const broadcast = empty(), quote = empty(), signup = empty()

  // ① email_logs (회원 메일 broadcast/test + 견적 quote)
  const { data: logs } = await supabaseAdmin
    .from('email_logs')
    .select('created_at, sent_count, type')
  ;(logs || []).forEach((r) => {
    const cnt = Number(r.sent_count) || 0
    if (r.type === 'quote') add(quote, r.created_at as string, cnt)
    else add(broadcast, r.created_at as string, cnt) // broadcast/test
  })

  // ② 회원가입 인증 메일 = 가입 회원 수(created_at 기준)로 집계
  try {
    const perPage = 1000
    for (let page = 1; page <= 100; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      const users = data?.users || []
      users.forEach((u) => { if (u.created_at) add(signup, u.created_at, 1) })
      if (users.length < perPage) break
    }
  } catch { /* 무시 */ }

  const totalBucket: Bucket = {
    today: broadcast.today + quote.today + signup.today,
    month: broadcast.month + quote.month + signup.month,
    total: broadcast.total + quote.total + signup.total,
  }

  return NextResponse.json({
    available: true,
    total: totalBucket,
    byType: { broadcast, quote, signup },
    // 하위호환 (기존 카드)
    today: totalBucket.today, month: totalBucket.month,
  })
}
