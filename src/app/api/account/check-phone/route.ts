export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const digits = (v: unknown) => String(v ?? '').replace(/[^0-9]/g, '')

// 전화번호 중복 확인 — 이미 가입된 번호면 taken:true
// excludeSelf=true면 본인(로그인 사용자)은 제외하고 검사 (회원정보 수정용)
export async function POST(req: Request) {
  const { phone, excludeSelf } = await req.json()
  const target = digits(phone)
  if (target.length < 10) {
    return NextResponse.json({ error: '올바른 전화번호를 입력해주세요.' }, { status: 400 })
  }

  let selfId: string | null = null
  if (excludeSelf) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    selfId = user?.id || null
  }

  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const users = data?.users || []
    for (const u of users) {
      if (selfId && u.id === selfId) continue
      const meta = u.user_metadata || {}
      if (meta.withdrawn) continue // 탈퇴 회원은 번호 재사용 허용
      if (digits(meta.phone) === target) {
        return NextResponse.json({ taken: true })
      }
    }
    if (users.length < perPage) break
  }

  return NextResponse.json({ taken: false })
}
