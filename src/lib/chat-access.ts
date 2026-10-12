import type { SupabaseClient } from '@supabase/supabase-js'
import { getLoginUser } from '@/lib/admin-auth'

// 채팅방 접근 확인
// - 회원 방: 로그인한 본인(또는 관리자)만
// - 비회원 방: 방 번호(추측 불가능한 UUID)를 아는 사람 = 그 방을 만든 브라우저
export async function canAccessRoom(admin: SupabaseClient, roomId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return false
  const { data: room } = await admin.from('chat_rooms').select('id,user_id').eq('id', roomId).maybeSingle()
  if (!room) return false
  if (!room.user_id) return true
  const user = await getLoginUser()
  if (!user) return false
  const role = user.user_metadata?.role
  return user.id === room.user_id || role === 'admin' || role === 'superadmin'
}
