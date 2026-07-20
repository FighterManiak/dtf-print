export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { POINT_EXPIRY_MONTHS } from '@/lib/grade'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자 포인트 지급/차감 (최고관리자 전용)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.user_metadata?.role !== 'superadmin') {
    return NextResponse.json({ error: '최고 관리자만 포인트를 지급할 수 있습니다.' }, { status: 403 })
  }

  const { userId, amount, memo } = await req.json()
  const amt = Math.round(Number(amount))
  if (!userId || !amt || Number.isNaN(amt)) {
    return NextResponse.json({ error: '회원과 포인트 금액은 필수입니다.' }, { status: 400 })
  }

  const adminEmail = user.email || '관리자'
  const note = (memo || '').trim()

  if (amt > 0) {
    // 지급 — 적립분으로 추가 (유효기간 적용)
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + POINT_EXPIRY_MONTHS)
    const { error } = await supabaseAdmin.from('points').insert({
      user_id: userId,
      amount: amt,
      balance_remaining: amt,
      type: 'earn',
      expires_at: expiresAt.toISOString(),
      memo: note ? `관리자 지급 · ${note}` : `관리자 지급 (${adminEmail})`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, granted: amt })
  }

  // 차감 — 오래된 적립분부터 FIFO 회수
  const deduct = Math.abs(amt)
  const nowIso = new Date().toISOString()
  const { data: earns } = await supabaseAdmin
    .from('points')
    .select('id,balance_remaining')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .gt('balance_remaining', 0)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })

  const available = (earns || []).reduce((s, e) => s + (Number(e.balance_remaining) || 0), 0)
  if (available < deduct) {
    return NextResponse.json({ error: `보유 포인트가 부족합니다. (보유 ${available.toLocaleString()}P)` }, { status: 400 })
  }

  let remaining = deduct
  for (const e of earns || []) {
    if (remaining <= 0) break
    const use = Math.min(remaining, Number(e.balance_remaining) || 0)
    await supabaseAdmin.from('points').update({ balance_remaining: (Number(e.balance_remaining) || 0) - use }).eq('id', e.id)
    remaining -= use
  }

  const { error } = await supabaseAdmin.from('points').insert({
    user_id: userId,
    amount: -deduct,
    balance_remaining: 0,
    type: 'use',
    memo: note ? `관리자 차감 · ${note}` : `관리자 차감 (${adminEmail})`,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deducted: deduct })
}
