export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PointRow {
  id: string
  user_id: string
  amount: number
  balance_remaining: number | null
  expires_at: string | null
  order_id: string | null
  memo: string | null
  created_at: string
}

// 삭제된 주문에 연결된 적립(고아 포인트) 집계
async function collectOrphans() {
  // 1) 주문 연결이 있는 적립 전체 조회 (페이지네이션)
  const earns: PointRow[] = []
  const CHUNK = 1000
  for (let from = 0; from < 100000; from += CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('points')
      .select('id,user_id,amount,balance_remaining,expires_at,order_id,memo,created_at')
      .eq('type', 'earn')
      .not('order_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error || !data || data.length === 0) break
    earns.push(...(data as PointRow[]))
    if (data.length < CHUNK) break
  }

  // 2) 실제 존재하는 주문 ID 집합
  const orderIds = [...new Set(earns.map((e) => e.order_id).filter(Boolean) as string[])]
  const alive = new Set<string>()
  for (let i = 0; i < orderIds.length; i += 200) {
    const slice = orderIds.slice(i, i + 200)
    const { data: o } = await supabaseAdmin.from('orders').select('id').in('id', slice)
    ;(o || []).forEach((r) => alive.add(r.id as string))
    try {
      const { data: mo } = await supabaseAdmin.from('material_orders').select('id').in('id', slice)
      ;(mo || []).forEach((r) => alive.add(r.id as string))
    } catch { /* 테이블 없으면 무시 */ }
  }

  // 3) 존재하지 않는 주문에 연결된 적립 = 고아
  const orphans = earns.filter((e) => e.order_id && !alive.has(e.order_id))

  // 4) 회원별 집계
  const nowIso = new Date().toISOString()
  const byUser: Record<string, { count: number; earned: number; remaining: number; rows: PointRow[] }> = {}
  orphans.forEach((r) => {
    if (!byUser[r.user_id]) byUser[r.user_id] = { count: 0, earned: 0, remaining: 0, rows: [] }
    const b = byUser[r.user_id]
    b.count += 1
    b.earned += Number(r.amount) || 0
    // 아직 유효한(미만료·미사용) 잔액만 회수 대상
    if ((Number(r.balance_remaining) || 0) > 0 && r.expires_at && r.expires_at > nowIso) {
      b.remaining += Number(r.balance_remaining) || 0
    }
    b.rows.push(r)
  })

  return byUser
}

// 관리자: 고아 포인트 현황 조회
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const byUser = await collectOrphans()
  const ids = Object.keys(byUser)
  if (ids.length === 0) return NextResponse.json({ members: [], totalRemaining: 0 })

  // 회원 정보 매핑
  const info: Record<string, { name: string; company: string; email: string }> = {}
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users || []
    users.forEach((u) => {
      if (byUser[u.id]) {
        const m = u.user_metadata || {}
        info[u.id] = { name: m.full_name || m.name || '', company: m.company || '', email: u.email || '' }
      }
    })
    if (users.length < perPage) break
  }

  const members = ids.map((id) => ({
    userId: id,
    name: info[id]?.name || '(알 수 없음)',
    company: info[id]?.company || '',
    email: info[id]?.email || '',
    건수: byUser[id].count,
    적립총액: byUser[id].earned,
    회수가능액: byUser[id].remaining,
    내역: byUser[id].rows.map((r) => ({
      일시: new Date(new Date(r.created_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '),
      금액: r.amount, 잔여: r.balance_remaining, 메모: r.memo,
    })),
  })).sort((a, b) => b.회수가능액 - a.회수가능액)

  return NextResponse.json({
    members,
    totalRemaining: members.reduce((s, m) => s + m.회수가능액, 0),
    totalEarned: members.reduce((s, m) => s + m.적립총액, 0),
  })
}

// 관리자: 고아 포인트 일괄 회수 (최고관리자 전용)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 회수할 수 있습니다.' }, { status: 403 })
  }

  const { userIds } = await req.json()
  const byUser = await collectOrphans()
  const targets = Array.isArray(userIds) && userIds.length > 0
    ? userIds.filter((id: string) => byUser[id])
    : Object.keys(byUser)

  const nowIso = new Date().toISOString()
  let revoked = 0
  let count = 0

  for (const uid of targets) {
    for (const r of byUser[uid].rows) {
      const remain = Number(r.balance_remaining) || 0
      if (remain <= 0 || !r.expires_at || r.expires_at <= nowIso) continue
      // 적립분 잔액 0으로 + 환수 기록 남김
      await supabaseAdmin.from('points').update({ balance_remaining: 0 }).eq('id', r.id)
      await supabaseAdmin.from('points').insert({
        user_id: uid,
        amount: -remain,
        balance_remaining: 0,
        type: 'revoke',
        memo: `삭제된 주문 적립분 회수 (${r.memo || '적립'})`,
      })
      revoked += remain
      count += 1
    }
  }

  return NextResponse.json({ success: true, 회수건수: count, 회수금액: revoked, 대상회원수: targets.length })
}
