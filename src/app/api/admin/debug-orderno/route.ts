export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] order_no 컬럼 존재 여부 및 부여 현황
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const check = async (table: string) => {
    const { data, error } = await supabaseAdmin
      .from(table).select('id, order_no').order('created_at', { ascending: false }).limit(5)
    if (error) {
      return {
        컬럼존재: !error.message.includes('order_no'),
        오류: error.message,
      }
    }
    const { count: total } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    const { count: filled } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).not('order_no', 'is', null)
    return {
      컬럼존재: true,
      전체: total ?? 0,
      주문번호있음: filled ?? 0,
      주문번호없음: (total ?? 0) - (filled ?? 0),
      최근5건: (data || []).map((r) => r.order_no),
    }
  }

  return NextResponse.json({
    orders: await check('orders'),
    quotes: await check('quotes'),
    material_orders: await check('material_orders'),
    안내: 'SQL 미실행 시 오류 메시지에 order_no 관련 내용이 표시됩니다.',
  })
}
