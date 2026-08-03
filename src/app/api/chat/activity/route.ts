export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 고객 메시지 전송 시 방 갱신 — 완료된 방이면 자동 재오픈 (서비스롤, RLS 우회)
export async function POST(req: Request) {
  const { roomId, lastMessage } = await req.json()
  if (!roomId) return NextResponse.json({ error: 'roomId 필요' }, { status: 400 })

  const { error } = await supabaseAdmin.from('chat_rooms').update({
    last_message: (lastMessage || '사진').slice(0, 200),
    last_message_at: new Date().toISOString(),
    status: 'open', // 고객이 다시 문의하면 재오픈
  }).eq('id', roomId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
