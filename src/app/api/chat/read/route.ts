export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canAccessRoom } from '@/lib/chat-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 고객이 방을 읽음 → user_last_read_at 갱신 + 관리자 읽음시각 반환 (서비스롤, RLS 우회)
export async function POST(req: Request) {
  const { roomId } = await req.json()
  if (!(await canAccessRoom(supabaseAdmin, String(roomId || '')))) {
    return NextResponse.json({ error: '채팅방을 찾을 수 없습니다.' }, { status: 404 })
  }

  await supabaseAdmin.from('chat_rooms').update({ user_last_read_at: new Date().toISOString() }).eq('id', roomId)
  const { data: room } = await supabaseAdmin.from('chat_rooms').select('admin_last_read_at').eq('id', roomId).single()

  return NextResponse.json({ adminReadAt: room?.admin_last_read_at || null })
}
