export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자: 문의 채팅 통계 (진행중 / 미답변 / 오늘 신규)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data: rooms, error } = await supabaseAdmin
    .from('chat_rooms')
    .select('id, status, created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const openRooms = (rooms || []).filter((r) => r.status === 'open')
  const openIds = openRooms.map((r) => r.id as string)

  // 미답변 = 진행중 방 중 마지막 메시지가 고객(user)인 방
  let unanswered = 0
  if (openIds.length > 0) {
    const { data: msgs } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id, sender_type, created_at')
      .in('room_id', openIds)
      .order('created_at', { ascending: false })
    const lastByRoom: Record<string, string> = {}
    ;(msgs || []).forEach((m) => {
      const rid = m.room_id as string
      if (!(rid in lastByRoom)) lastByRoom[rid] = m.sender_type as string
    })
    unanswered = Object.values(lastByRoom).filter((s) => s === 'user').length
  }

  // 오늘(KST) 신규 문의 방
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const todayNew = (rooms || []).filter((r) => {
    const d = new Date(new Date(r.created_at as string).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    return d === todayStr
  }).length

  return NextResponse.json({ open: openRooms.length, unanswered, todayNew })
}
