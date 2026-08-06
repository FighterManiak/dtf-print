export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TARGET = '70caae27-2fc9-4b8f-a70d-670b305a5643'

// [임시 진단] 주문관리 목록/연결 상태 확인 — 관리자 전용
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data: orders, error: oErr } = await supabaseAdmin.from('orders').select('*,order_items(*)').order('created_at', { ascending: false })
  const { data: quotes, error: qErr } = await supabaseAdmin.from('quotes').select('*').order('created_at', { ascending: false })

  const targetOrder = (orders || []).find((o) => o.id === TARGET)
  const linkingQuote = (quotes || []).find((q) => q.order_id === TARGET)

  return NextResponse.json({
    ordersCount: orders?.length ?? 0,
    quotesCount: quotes?.length ?? 0,
    ordersError: oErr?.message || null,
    quotesError: qErr?.message || null,
    targetOrder: targetOrder || '주문 목록에 없음',
    linkingQuote: linkingQuote || '이 주문을 연결한 견적 없음(=직접주문으로 표시돼야 함)',
  })
}
