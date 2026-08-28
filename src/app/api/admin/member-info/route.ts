export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자: 회원 회사명 수정 + 관리자 메모(회사 특징) 저장
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { userId, company, adminNote } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (!target?.user) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 })

  const meta = { ...(target.user.user_metadata || {}) }
  if (company !== undefined) meta.company = String(company || '').trim()
  if (adminNote !== undefined) {
    const note = String(adminNote || '').trim()
    if (note) {
      meta.admin_note = note
      meta.admin_note_by = user?.email || null
      meta.admin_note_at = new Date().toISOString()
    } else {
      delete meta.admin_note
      delete meta.admin_note_by
      delete meta.admin_note_at
    }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: meta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
