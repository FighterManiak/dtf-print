export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// 인증 첨부파일 서명 URL 발급 (RLS 우회) — 관리자 전용
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { path, bucket } = await req.json()
  if (!path) return NextResponse.json({ error: 'path 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from(bucket || 'verify-files')
    .createSignedUrl(path, 300)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || '파일을 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
