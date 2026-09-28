export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function isAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  return role === 'admin' || role === 'superadmin'
}

// 전체 상품 (관리자 — 비활성 포함)
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data, error } = await supabaseAdmin.from('products').select('*').order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 생성
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!b.id?.trim() || !b.name?.trim()) return NextResponse.json({ error: '상품 ID와 이름은 필수입니다.' }, { status: 400 })

  const row = {
    id: String(b.id).trim(),
    name: String(b.name).trim(),
    description: b.description || '',
    price: Number(b.price) || 0,
    unit: b.unit || '개',
    is_roll: !!b.is_roll,
    verified_only: !!b.verified_only,
    cutting_available: !!b.cutting_available,
    active: b.active !== false,
    sort_order: Number(b.sort_order) || 0,
  }
  const { error } = await supabaseAdmin.from('products').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 수정
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'description', 'price', 'unit', 'is_roll', 'verified_only', 'cutting_available', 'active', 'sort_order']) {
    if (b[k] !== undefined) patch[k] = b[k]
  }
  const { error } = await supabaseAdmin.from('products').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 삭제
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  // 주문 이력이 있는 상품은 삭제하지 않고 판매중지 처리
  // (삭제하면 과거 주문의 상품명·단위를 복원할 수 없어 엑셀이 깨짐)
  const { count } = await supabaseAdmin
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id)

  if ((count ?? 0) > 0) {
    const { error: offErr } = await supabaseAdmin
      .from('products').update({ active: false }).eq('id', id)
    if (offErr) return NextResponse.json({ error: offErr.message }, { status: 500 })
    return NextResponse.json({
      success: true,
      softDeleted: true,
      orderCount: count,
      message: `이 상품으로 주문된 내역이 ${count}건 있어 삭제 대신 판매중지 처리했습니다.\n(과거 주문의 상품명·단위를 유지하기 위함입니다)`,
    })
  }

  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
