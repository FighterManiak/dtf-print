export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'business-docs'

// 관리자: 특정 회원의 사업자등록증 서명 URL 조회
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId)
  const lic = target.user?.user_metadata?.business_license as { path?: string; name?: string } | undefined
  if (!lic?.path) return NextResponse.json({ exists: false })

  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(lic.path, 60 * 10)
  return NextResponse.json({ exists: true, name: lic.name || '사업자등록증', url: data?.signedUrl || null })
}
