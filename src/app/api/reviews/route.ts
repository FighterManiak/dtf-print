export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 이미지 경로 → 서명 URL (1주일)
async function signImages(paths: string[] | null): Promise<string[]> {
  if (!paths || paths.length === 0) return []
  const urls: string[] = []
  for (const p of paths) {
    const { data } = await supabaseAdmin.storage.from('order-files').createSignedUrl(p, 60 * 60 * 24 * 7)
    if (data?.signedUrl) urls.push(data.signedUrl)
  }
  return urls
}

// 공개: 노출 리뷰 목록 (고정 → 정렬순서 → 최신)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit')) || 100

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('hidden', false)
    .order('pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviews = await Promise.all((data || []).map(async (r) => ({
    ...r,
    image_urls: await signImages(r.image_paths),
  })))
  return NextResponse.json(reviews)
}

// 리뷰 작성 (배송완료 주문 고객만, 주문당 1회)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { orderId, quoteId, rating, content, imagePaths } = await req.json()
  if ((!orderId && !quoteId) || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: '주문과 별점(1~5)은 필수입니다.' }, { status: 400 })
  }

  let orderName: string | null = null

  if (orderId) {
    // 주문 레코드 기준 — 소유·배송완료 확인
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id,user_id,status,order_name')
      .eq('id', orderId)
      .single()
    if (!order || order.user_id !== user.id) return NextResponse.json({ error: '본인 주문만 리뷰할 수 있습니다.' }, { status: 403 })
    if (order.status !== 'delivered') return NextResponse.json({ error: '배송 완료된 주문만 리뷰할 수 있습니다.' }, { status: 400 })
    orderName = order.order_name || null

    const { data: dup } = await supabaseAdmin.from('reviews').select('id').eq('order_id', orderId).limit(1)
    if (dup && dup.length > 0) return NextResponse.json({ error: '이미 리뷰를 작성한 주문입니다.' }, { status: 400 })
  } else {
    // 주문 레코드가 없는 견적 기준 — 소유·배송완료 확인
    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id,user_id,status,order_name')
      .eq('id', quoteId)
      .single()
    if (!quote || quote.user_id !== user.id) return NextResponse.json({ error: '본인 주문만 리뷰할 수 있습니다.' }, { status: 403 })
    if (quote.status !== 'delivered') return NextResponse.json({ error: '배송 완료된 주문만 리뷰할 수 있습니다.' }, { status: 400 })
    orderName = quote.order_name || null

    const { data: dup } = await supabaseAdmin.from('reviews').select('id').eq('quote_id', quoteId).limit(1)
    if (dup && dup.length > 0) return NextResponse.json({ error: '이미 리뷰를 작성한 주문입니다.' }, { status: 400 })
  }

  const userName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email?.split('@')[0]) || '고객'
  const { error } = await supabaseAdmin.from('reviews').insert({
    user_id: user.id,
    order_id: orderId || null,
    quote_id: orderId ? null : quoteId,
    user_name: userName,
    rating: Math.round(rating),
    content: (content || '').trim() || null,
    image_paths: Array.isArray(imagePaths) && imagePaths.length ? imagePaths : null,
    order_name: orderName,
    hidden: false,
    pinned: false,
    sort_order: 0,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
