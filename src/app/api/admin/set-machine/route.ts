export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 실제 작업 장비 번호 지정 (관리자)
export async function POST(req: Request) {
  const { orderId, assignedMachine } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ assigned_machine: assignedMachine || null })
    .eq('id', orderId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
