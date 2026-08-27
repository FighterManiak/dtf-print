export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 회원별 마지막 활동 시각 (주문·견적·자재구매 중 가장 최근)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const last: Record<string, string> = {}
  const put = (uid: string | null, iso: string | null) => {
    if (!uid || !iso) return
    if (!last[uid] || iso > last[uid]) last[uid] = iso
  }

  // 1000행 제한 대비 페이지네이션
  const collect = async (table: string) => {
    const CHUNK = 1000
    for (let from = 0; from < 100000; from += CHUNK) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, from + CHUNK - 1)
      if (error || !data || data.length === 0) break
      data.forEach((r) => put(r.user_id as string, r.created_at as string))
      if (data.length < CHUNK) break
    }
  }

  await collect('orders')
  await collect('quotes')
  try { await collect('material_orders') } catch { /* 테이블 없으면 무시 */ }

  return NextResponse.json({ lastActivity: last })
}
