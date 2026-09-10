export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 로그인 회원의 증빙(세금계산서·현금영수증) 발행 정보 조회
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ info: null })

  const m = user.user_metadata || {}
  return NextResponse.json({
    info: m.receipt_info || null,
    // 회원가입 시 입력한 회사명이 있으면 상호 기본값으로 활용
    company: m.company || '',
  })
}

// 증빙 발행 정보 저장 (다음 주문에서 자동 입력)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const b = await req.json()
  const clean = (v: unknown, max = 100) => String(v ?? '').trim().slice(0, max)

  const info = {
    type: b.type === 'cash_receipt' ? 'cash_receipt' : 'tax_invoice',
    bizNo: clean(b.bizNo, 20),
    company: clean(b.company, 60),
    ceo: clean(b.ceo, 30),
    email: clean(b.email, 100),
    cashPurpose: b.cashPurpose === 'business' ? 'business' : 'personal',
    cashNo: clean(b.cashNo, 20),
    savedAt: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata || {}), receipt_info: info },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 저장된 정보 삭제
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const meta = { ...(user.user_metadata || {}) }
  delete meta.receipt_info

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: meta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
