export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canAccessRoom } from '@/lib/chat-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 고객 채팅 메시지 조회 — 공개키로 직접 읽지 못하게 막고 서버에서 방 권한 확인 후 반환
export async function GET(req: Request) {
  const roomId = new URL(req.url).searchParams.get('roomId') || ''
  if (!(await canAccessRoom(supabaseAdmin, roomId))) {
    return NextResponse.json({ error: '채팅방을 찾을 수 없습니다.' }, { status: 404 })
  }
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id,content,image_url,sender_type,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 고객 메시지 전송 + 방 갱신 (완료된 방이면 재오픈)
export async function POST(req: Request) {
  const { roomId, content, imageUrl } = await req.json()
  const rid = String(roomId || '')
  if (!(await canAccessRoom(supabaseAdmin, rid))) {
    return NextResponse.json({ error: '채팅방을 찾을 수 없습니다.' }, { status: 404 })
  }
  const text = String(content || '').trim().slice(0, 2000) || null
  // 이미지는 우리 스토리지(chat-images)에 올린 주소만 허용
  const img = typeof imageUrl === 'string' && imageUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-images/`)
    ? imageUrl : null
  if (!text && !img) return NextResponse.json({ error: '내용이 없습니다.' }, { status: 400 })

  const { data: room } = await supabaseAdmin.from('chat_rooms').select('user_id').eq('id', rid).single()
  const { data: msg, error } = await supabaseAdmin.from('chat_messages').insert({
    room_id: rid,
    sender_id: room?.user_id || null,
    sender_type: 'user',
    content: text,
    image_url: img,
  }).select('id,content,image_url,sender_type,created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('chat_rooms').update({
    last_message: (text || '사진').slice(0, 200),
    last_message_at: new Date().toISOString(),
    status: 'open',
  }).eq('id', rid)

  return NextResponse.json(msg)
}
