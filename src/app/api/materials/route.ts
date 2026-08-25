export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 자재 상품 목록 (판매중만) / id 지정 시 상세 + 리뷰
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')

  if (id) {
    const { data: material, error } = await supabaseAdmin
      .from('materials').select('*').eq('id', id).single()
    if (error || !material) return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })

    const { data: reviews } = await supabaseAdmin
      .from('material_reviews')
      .select('id,created_at,user_name,rating,content,images')
      .eq('material_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ material, reviews: reviews || [] })
  }

  const { data, error } = await supabaseAdmin
    .from('materials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 상품별 리뷰 수/평점
  const { data: rv } = await supabaseAdmin
    .from('material_reviews').select('material_id,rating').eq('is_hidden', false)
  const stat: Record<string, { count: number; sum: number }> = {}
  ;(rv || []).forEach((r) => {
    const k = r.material_id as string
    if (!stat[k]) stat[k] = { count: 0, sum: 0 }
    stat[k].count += 1
    stat[k].sum += Number(r.rating) || 0
  })

  const list = (data || []).map((m) => ({
    ...m,
    reviewCount: stat[m.id]?.count || 0,
    rating: stat[m.id]?.count ? +(stat[m.id].sum / stat[m.id].count).toFixed(1) : null,
  }))

  return NextResponse.json(list)
}
