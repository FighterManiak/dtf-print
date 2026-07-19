export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 로그인 유저가 이미 리뷰한 주문/견적 ID 목록
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin.from('reviews').select('order_id, quote_id').eq('user_id', user.id)
  const rows = data || []
  return NextResponse.json({
    reviewedOrderIds: rows.map((r) => r.order_id).filter(Boolean),
    reviewedQuoteIds: rows.map((r) => r.quote_id).filter(Boolean),
  })
}
