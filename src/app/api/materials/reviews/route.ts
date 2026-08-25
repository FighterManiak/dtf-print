export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 자재 리뷰 작성 (구매 이력 있는 회원만)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { materialId, rating, content, images } = await req.json()
  if (!materialId) return NextResponse.json({ error: 'materialId 필요' }, { status: 400 })
  if (!String(content || '').trim()) return NextResponse.json({ error: '리뷰 내용을 입력해주세요.' }, { status: 400 })

  // 이 상품을 구매한 적 있는지 확인
  const { data: orders } = await supabaseAdmin
    .from('material_orders').select('id,items,status')
    .eq('user_id', user.id)
    .in('status', ['paid', 'in_progress', 'shipped', 'delivered'])

  const bought = (orders || []).find((o) => {
    const items = (o.items as { materialId: string }[]) || []
    return items.some((i) => i.materialId === materialId)
  })
  if (!bought) return NextResponse.json({ error: '구매하신 상품만 리뷰를 작성할 수 있습니다.' }, { status: 403 })

  // 중복 방지
  const { data: existing } = await supabaseAdmin
    .from('material_reviews').select('id')
    .eq('material_id', materialId).eq('user_id', user.id).limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: '이미 이 상품에 리뷰를 작성하셨습니다.' }, { status: 400 })
  }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0]
  const masked = name.length > 1 ? name[0] + '○'.repeat(Math.max(1, name.length - 1)) : name

  const { error } = await supabaseAdmin.from('material_reviews').insert({
    material_id: materialId,
    order_id: bought.id,
    user_id: user.id,
    user_name: masked,
    rating: Math.min(5, Math.max(1, Math.round(Number(rating) || 5))),
    content: String(content).trim(),
    images: Array.isArray(images) ? images : [],
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
