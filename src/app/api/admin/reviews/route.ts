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

async function signImages(paths: string[] | null): Promise<string[]> {
  if (!paths || paths.length === 0) return []
  const urls: string[] = []
  for (const p of paths) {
    const { data } = await supabaseAdmin.storage.from('order-files').createSignedUrl(p, 60 * 60 * 24 * 7)
    if (data?.signedUrl) urls.push(data.signedUrl)
  }
  return urls
}

// 전체 리뷰 (숨김 포함)
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .order('pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const reviews = await Promise.all((data || []).map(async (r) => ({ ...r, image_urls: await signImages(r.image_paths) })))
  return NextResponse.json(reviews)
}

// 노출 순서 / 고정 / 숨김 수정
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  for (const k of ['sort_order', 'pinned', 'hidden']) if (b[k] !== undefined) patch[k] = b[k]
  const { error } = await supabaseAdmin.from('reviews').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 삭제
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
