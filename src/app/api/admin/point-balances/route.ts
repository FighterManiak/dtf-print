export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 회원별 사용 가능 포인트 (만료 안 된 적립분의 남은 잔액 합)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('points')
    .select('user_id, balance_remaining')
    .eq('type', 'earn')
    .gt('balance_remaining', 0)
    .gt('expires_at', nowIso)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const balances: Record<string, number> = {}
  ;(data || []).forEach((r) => {
    balances[r.user_id as string] = (balances[r.user_id as string] || 0) + (Number(r.balance_remaining) || 0)
  })
  return NextResponse.json({ balances })
}
