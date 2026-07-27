export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 특정 회원의 포인트 적립/사용/환수 상세 내역 (관리자)
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('points')
    .select('id, created_at, amount, type, balance_remaining, expires_at, order_id, memo')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []

  const nowIso = new Date().toISOString()
  // 요약 집계
  let totalEarned = 0   // 누적 적립 (revoke 제외)
  let totalUsed = 0     // 누적 사용
  let totalRevoked = 0  // 누적 환수
  let available = 0     // 사용 가능 (만료 안 된 적립 잔액)
  rows.forEach((r) => {
    const amt = Number(r.amount) || 0
    if (r.type === 'earn') {
      totalEarned += amt
      if ((Number(r.balance_remaining) || 0) > 0 && r.expires_at && r.expires_at > nowIso) {
        available += Number(r.balance_remaining) || 0
      }
    } else if (r.type === 'use') {
      totalUsed += Math.abs(amt)
    } else if (r.type === 'revoke') {
      totalRevoked += Math.abs(amt)
    }
  })

  return NextResponse.json({
    summary: { totalEarned, totalUsed, totalRevoked, available },
    transactions: rows,
  })
}
