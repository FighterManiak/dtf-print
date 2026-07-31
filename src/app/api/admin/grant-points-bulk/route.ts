export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { POINT_EXPIRY_MONTHS } from '@/lib/grade'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자 포인트 일괄 지급 (최고관리자 전용) — 선택 회원들에게 동일 금액 적립
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 포인트를 지급할 수 있습니다.' }, { status: 403 })
  }

  const { userIds, amount, memo } = await req.json()
  const amt = Math.round(Number(amount))
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: '지급 대상 회원을 선택해주세요.' }, { status: 400 })
  }
  if (!amt || Number.isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: '지급 포인트는 1 이상이어야 합니다.' }, { status: 400 })
  }

  const adminEmail = user.email || '관리자'
  const note = (memo || '').trim()
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + POINT_EXPIRY_MONTHS)
  const exp = expiresAt.toISOString()

  const rows = userIds.map((uid: string) => ({
    user_id: uid,
    amount: amt,
    balance_remaining: amt,
    type: 'earn',
    expires_at: exp,
    memo: note ? `관리자 일괄지급 · ${note}` : `관리자 일괄지급 (${adminEmail})`,
  }))

  const { error } = await supabaseAdmin.from('points').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: userIds.length, granted: amt })
}
