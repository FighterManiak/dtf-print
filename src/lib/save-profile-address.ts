import type { SupabaseClient } from '@supabase/supabase-js'

interface AddressInput {
  zonecode?: string | null
  address?: string | null
  addressDetail?: string | null
  phone?: string | null
}

// 주문 시 입력한 배송지를 회원정보에 저장한다.
// 이미 등록된 값은 덮어쓰지 않고, 비어 있는 항목만 채운다.
export async function saveProfileAddress(
  admin: SupabaseClient,
  userId: string | null | undefined,
  input: AddressInput
): Promise<void> {
  if (!userId) return

  const zonecode = String(input.zonecode || '').replace(/\D/g, '').slice(0, 5)
  const address = String(input.address || '').trim()
  const addressDetail = String(input.addressDetail || '').trim()
  const phone = String(input.phone || '').replace(/\D/g, '')
  if (!address && !phone) return

  const { data } = await admin.auth.admin.getUserById(userId)
  const meta = data?.user?.user_metadata || {}

  const patch: Record<string, unknown> = {}
  // 주소는 우편번호까지 있을 때만 저장 (택배 발송에 쓸 수 있는 형태로)
  if (!String(meta.address || '').trim() && address && zonecode) {
    patch.zonecode = zonecode
    patch.address = address
    patch.address_detail = addressDetail
  }
  if (!String(meta.phone || '').trim() && phone.length >= 10) {
    patch.phone = phone
  }
  if (Object.keys(patch).length === 0) return

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...meta, ...patch },
  })
}
