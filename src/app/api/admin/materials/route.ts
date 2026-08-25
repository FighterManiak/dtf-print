export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  return role === 'admin' || role === 'superadmin'
}

// 관리자: 전체 상품 조회 (비활성 포함)
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data, error } = await supabaseAdmin
    .from('materials').select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 관리자: 상품 등록
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!String(b.name || '').trim()) return NextResponse.json({ error: '상품명을 입력해주세요.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('materials').insert({
    name: String(b.name).trim(),
    description: String(b.description || '').trim() || null,
    detail: String(b.detail || '').trim() || null,
    price: Math.max(0, Math.round(Number(b.price) || 0)),
    origin_price: b.originPrice ? Math.round(Number(b.originPrice)) : null,
    unit: String(b.unit || '개').trim(),
    stock: b.stock === '' || b.stock == null ? null : Math.max(0, Math.round(Number(b.stock))),
    category: String(b.category || '').trim() || null,
    images: Array.isArray(b.images) ? b.images : [],
    is_active: b.isActive !== false,
    sort_order: Math.round(Number(b.sortOrder) || 0),
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}

// 관리자: 상품 수정
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (b.name !== undefined) patch.name = String(b.name).trim()
  if (b.description !== undefined) patch.description = String(b.description).trim() || null
  if (b.detail !== undefined) patch.detail = String(b.detail).trim() || null
  if (b.price !== undefined) patch.price = Math.max(0, Math.round(Number(b.price) || 0))
  if (b.originPrice !== undefined) patch.origin_price = b.originPrice ? Math.round(Number(b.originPrice)) : null
  if (b.unit !== undefined) patch.unit = String(b.unit).trim()
  if (b.stock !== undefined) patch.stock = b.stock === '' || b.stock === null ? null : Math.max(0, Math.round(Number(b.stock)))
  if (b.category !== undefined) patch.category = String(b.category).trim() || null
  if (b.images !== undefined) patch.images = Array.isArray(b.images) ? b.images : []
  if (b.isActive !== undefined) patch.is_active = !!b.isActive
  if (b.sortOrder !== undefined) patch.sort_order = Math.round(Number(b.sortOrder) || 0)

  const { error } = await supabaseAdmin.from('materials').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 관리자: 상품 삭제
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  const { error } = await supabaseAdmin.from('materials').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
