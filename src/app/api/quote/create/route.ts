export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 견적 요청 생성 (RLS 우회) — 로그인 유저 본인 명의로 저장
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const b = await req.json()

  const { error } = await supabaseAdmin.from('quotes').insert({
    user_id: user.id,
    user_name: b.userName || null,
    user_email: b.userEmail || user.email || null,
    user_phone: b.userPhone || null,
    user_address: b.userAddress || null,
    product_type: b.productType || null,
    order_name: (b.orderName || '').trim() || null,
    request_note: b.requestNote || null,
    machine_no: b.machineNo || null,
    file_url: b.fileUrls?.length ? JSON.stringify(b.fileUrls) : null,
    file_name: b.fileNames?.length ? JSON.stringify(b.fileNames) : null,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
