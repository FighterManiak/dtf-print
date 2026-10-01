import type { SupabaseClient } from '@supabase/supabase-js'

// 새로 추가한 컬럼(예: depositor_name)이 아직 DB에 없을 때도 주문이 실패하지 않도록,
// '컬럼 없음' 오류가 나면 해당 필드를 빼고 한 번 더 저장한다.
export async function insertWithOptional<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  row: T,
  optionalKeys: string[],
  select = 'id'
) {
  const first = await admin.from(table).insert(row).select(select).single()
  if (!first.error) return first

  const msg = String(first.error.message || '')
  const missing = optionalKeys.filter((k) => msg.includes(k))
  if (missing.length === 0) return first

  const fallback: Record<string, unknown> = { ...row }
  missing.forEach((k) => { delete fallback[k] })
  return admin.from(table).insert(fallback).select(select).single()
}
