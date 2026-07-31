export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'business-docs'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

async function ensureBucket() {
  try {
    const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
    if (!data) await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES })
  } catch {
    try { await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES }) } catch { /* 이미 존재 */ }
  }
}

// 현재 회원의 사업자등록증 조회 (서명 URL)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const lic = user.user_metadata?.business_license as { path?: string; name?: string; uploaded_at?: string } | undefined
  if (!lic?.path) return NextResponse.json({ exists: false })

  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(lic.path, 60 * 10)
  return NextResponse.json({ exists: true, name: lic.name || '사업자등록증', uploadedAt: lic.uploaded_at || null, url: data?.signedUrl || null })
}

// 사업자등록증 업로드
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '파일 크기는 최대 10MB까지 가능합니다.' }, { status: 400 })

  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
  const ok = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)
  if (!ok) return NextResponse.json({ error: 'PDF 또는 이미지 파일만 업로드할 수 있습니다.' }, { status: 400 })

  await ensureBucket()

  // 기존 파일 삭제
  const prev = user.user_metadata?.business_license as { path?: string } | undefined
  if (prev?.path) { try { await supabaseAdmin.storage.from(BUCKET).remove([prev.path]) } catch { /* 무시 */ } }

  const path = `${user.id}/${Date.now()}.${ext}`
  const buf = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || 'application/octet-stream', upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // user_metadata 병합 저장
  const meta = user.user_metadata || {}
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, business_license: { path, name: file.name, uploaded_at: new Date().toISOString() } },
  })
  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 })

  return NextResponse.json({ success: true, name: file.name })
}

// 사업자등록증 삭제
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const prev = user.user_metadata?.business_license as { path?: string } | undefined
  if (prev?.path) { try { await supabaseAdmin.storage.from(BUCKET).remove([prev.path]) } catch { /* 무시 */ } }

  const meta = { ...(user.user_metadata || {}) }
  delete meta.business_license
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: meta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
