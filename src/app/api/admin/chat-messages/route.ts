export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAdminUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') return null
  return user
}

// 관리자: 특정 방의 메시지 조회 (RLS 우회)
export async function GET(req: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const roomId = new URL(req.url).searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'roomId 필요' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 관리자: 답변 메시지 전송
export async function POST(req: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { roomId, content, imageUrl } = await req.json()
  if (!roomId || (!content && !imageUrl)) return NextResponse.json({ error: '내용 필요' }, { status: 400 })

  const { data: newMsg, error } = await supabaseAdmin.from('chat_messages').insert({
    room_id: roomId,
    sender_id: user.id,
    sender_type: 'admin',
    content: content || null,
    image_url: imageUrl || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('chat_rooms').update({
    last_message: content || '사진',
    last_message_at: new Date().toISOString(),
  }).eq('id', roomId)

  return NextResponse.json(newMsg)
}
