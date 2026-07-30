export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  return role === 'admin' || role === 'superadmin'
}

// 관리자: 전체 채팅방 목록 (RLS 우회)
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data, error } = await supabaseAdmin
    .from('chat_rooms')
    .select('*')
    .order('last_message_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 관리자: 채팅방 상태 변경 (완료/재오픈)
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { roomId, status } = await req.json()
  if (!roomId || !status) return NextResponse.json({ error: 'roomId, status 필요' }, { status: 400 })
  const { error } = await supabaseAdmin.from('chat_rooms').update({ status }).eq('id', roomId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
