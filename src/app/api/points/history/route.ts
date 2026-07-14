export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getAvailablePoints } from '@/lib/points-server'
import { POINT_USE_THRESHOLD } from '@/lib/grade'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const available = await getAvailablePoints(supabaseAdmin, user.id)

  const { data: rows } = await supabaseAdmin
    .from('points')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 30일 내 만료 예정 포인트 합
  const now = Date.now()
  const soonMs = now + 30 * 24 * 60 * 60 * 1000
  const expiringSoon = (rows || [])
    .filter((r) => r.type === 'earn' && r.balance_remaining > 0 && r.expires_at && new Date(r.expires_at).getTime() > now && new Date(r.expires_at).getTime() <= soonMs)
    .reduce((s, r) => s + (Number(r.balance_remaining) || 0), 0)

  return NextResponse.json({ available, usable: available >= POINT_USE_THRESHOLD, threshold: POINT_USE_THRESHOLD, expiringSoon, transactions: rows || [] })
}
