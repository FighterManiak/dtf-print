export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'material-images'

async function ensureBucket() {
  try {
    const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
    if (!data) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 })
    }
  } catch {
    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 }) } catch { /* 이미 존재 */ }
  }
}

// 관리자: 상품 이미지 업로드 (RLS 우회) → 저장 경로 반환
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const form = await req.formData()
  const files = form.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  await ensureBucket()

  const paths: string[] = []
  const errors: string[] = []
  for (const file of files.slice(0, 8)) {
    if (!file.type.startsWith('image/')) { errors.push(`${file.name}: 이미지 파일만 가능합니다.`); continue }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const buf = new Uint8Array(await file.arrayBuffer())
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || 'image/jpeg', upsert: true,
    })
    if (error) errors.push(`${file.name}: ${error.message}`)
    else paths.push(path)
  }

  if (paths.length === 0) {
    return NextResponse.json({ error: errors.join('\n') || '업로드에 실패했습니다.' }, { status: 500 })
  }
  return NextResponse.json({ success: true, paths, errors })
}
