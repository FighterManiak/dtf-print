export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// orders 테이블에 최소 컬럼만 넣어 insert 시도 → 실제 DB 에러 메시지 확인
export async function GET() {
  const attempts: { fields: string[]; ok: boolean; error: string | null; id?: string }[] = []

  const tryInsert = async (row: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin.from('orders').insert(row).select('id').single()
    attempts.push({ fields: Object.keys(row), ok: !error, error: error?.message || null, id: data?.id })
    // 성공하면 즉시 삭제 (테스트 데이터 잔존 방지)
    if (data?.id) await supabaseAdmin.from('orders').delete().eq('id', data.id)
  }

  // 1) 완전 최소
  await tryInsert({ status: 'pending', total_amount: 0 })
  // 2) user_* 컬럼
  await tryInsert({ status: 'pending', total_amount: 0, user_name: 't', user_email: 't@t.com', user_phone: '0', user_address: 'a' })
  // 3) customer_* 컬럼 (구 스키마)
  await tryInsert({ status: 'pending', total_amount: 0, customer_name: 't', customer_email: 't@t.com', customer_phone: '0', customer_address: 'a' })
  // 4) order_name / payment_method / memo
  await tryInsert({ status: 'pending', total_amount: 0, order_name: 'n', payment_method: 'CARD', memo: 'm' })

  return NextResponse.json({ attempts })
}
