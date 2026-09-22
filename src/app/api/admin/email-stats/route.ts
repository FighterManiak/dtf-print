export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)

// 주문 상태 알림 메일 종류
const ORDER_TYPES = ['ordered', 'payment_confirmed', 'in_progress', 'shipped']

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

  const broadcast = empty()   // 회원 대상 공지·안내 발송
  const quote = empty()       // 견적 안내
  const order = empty()       // 주문 접수·입금확인·작업시작·출고
  const tempPw = empty()      // 임시 비밀번호
  const test = empty()        // 테스트 발송 (실제 회원 발송과 분리)
  const etc = empty()
  const signup = empty()      // 가입 인증

  // ① email_logs — 1000행 제한을 넘기지 않도록 페이지네이션
  const CHUNK = 1000
  for (let from = 0; from < 200000; from += CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('email_logs')
      .select('created_at, sent_count, type')
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error || !data || data.length === 0) break

    data.forEach((r) => {
      const cnt = Number(r.sent_count) || 0
      const t = String(r.type || '')
      const iso = r.created_at as string
      if (t === 'quote') add(quote, iso, cnt)
      else if (t === 'broadcast') add(broadcast, iso, cnt)
      else if (t === 'test') add(test, iso, cnt)
      else if (t === 'temp_password') add(tempPw, iso, cnt)
      else if (ORDER_TYPES.includes(t)) add(order, iso, cnt)
      else add(etc, iso, cnt)
    })
    if (data.length < CHUNK) break
  }

  // ② 가입 인증 메일 = 이메일로 가입한 회원 수 (구글 가입은 인증메일이 없음)
  try {
    const perPage = 1000
    for (let page = 1; page <= 100; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      const users = data?.users || []
      users.forEach((u) => {
        const provider = u.app_metadata?.provider
        if (u.created_at && (!provider || provider === 'email')) add(signup, u.created_at, 1)
      })
      if (users.length < perPage) break
    }
  } catch { /* 무시 */ }

  const sum = (k: keyof Bucket) =>
    broadcast[k] + quote[k] + order[k] + tempPw[k] + test[k] + etc[k] + signup[k]

  const totalBucket: Bucket = { today: sum('today'), month: sum('month'), total: sum('total') }

  return NextResponse.json({
    available: true,
    total: totalBucket,
    byType: { broadcast, quote, order, tempPw, test, etc, signup },
    // 하위호환 (기존 카드)
    today: totalBucket.today, month: totalBucket.month,
  })
}
