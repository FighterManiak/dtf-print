export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// [임시 진단] material-images 버킷 상태 확인
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets()
  const target = (buckets || []).find((b) => b.id === 'material-images')

  let files: unknown = null
  let listErr: string | null = null
  if (target) {
    const { data, error } = await supabaseAdmin.storage.from('material-images').list('products', { limit: 10 })
    files = data?.map((f) => f.name) || []
    listErr = error?.message || null
  }

  // 등록된 상품의 images 값도 확인
  const { data: materials } = await supabaseAdmin
    .from('materials').select('id,name,images').order('created_at', { ascending: false }).limit(5)

  return NextResponse.json({
    버킷목록: (buckets || []).map((b) => ({ id: b.id, public: b.public })),
    버킷오류: bErr?.message || null,
    'material-images_존재': !!target,
    'material-images_공개': target?.public ?? null,
    'products폴더_파일': files,
    '파일목록_오류': listErr,
    최근상품_images: (materials || []).map((m) => ({ name: m.name, images: m.images })),
  })
}
