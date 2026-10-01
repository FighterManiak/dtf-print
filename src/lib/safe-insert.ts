import type { SupabaseClient } from '@supabase/supabase-js'

// 새로 추가한 컬럼(예: depositor_name)이 아직 DB에 없을 때도 주문이 실패하지 않도록,
// '컬럼 없음' 오류가 나면 해당 필드를 빼고 다시 저장한다.
// (DB는 없는 컬럼을 한 번에 하나씩 알려주므로 선택 컬럼 수만큼 반복)
export async function insertWithOptional<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  row: T,
  optionalKeys: string[],
  select = 'id'
) {
  const current: Record<string, unknown> = { ...row }
  let result = await admin.from(table).insert(current).select(select).single()

  for (let i = 0; i < optionalKeys.length && result.error; i++) {
    const msg = String(result.error.message || '')
    const missing = optionalKeys.filter((k) => k in current && msg.includes(k))
    if (missing.length === 0) break
    missing.forEach((k) => { delete current[k] })
    result = await admin.from(table).insert(current).select(select).single()
  }
  return result
}
