export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'order-files'
const RETENTION_DAYS = 30

function parsePaths(fileUrl: string | null): string[] {
  if (!fileUrl) return []
  try {
    const v = JSON.parse(fileUrl)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [fileUrl]
  } catch {
    return [fileUrl]
  }
}

// 견적 전용 파일 자동 정리 — 주문으로 이어지지 않은(order_id 없는) 30일 지난 견적의 파일 삭제
// Vercel Cron이 호출 (Authorization: Bearer CRON_SECRET). CRON_SECRET 미설정 시 인증 생략.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: '권한 없음' }, { status: 401 })
    }
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()

  // 주문으로 이어지지 않은(order_id null) + 30일 지난 + 파일 있는 견적
  const { data: quotes, error } = await supabaseAdmin
    .from('quotes')
    .select('id, file_url, created_at')
    .is('order_id', null)
    .lt('created_at', cutoff)
    .not('file_url', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let deletedFiles = 0
  let processedQuotes = 0
  for (const q of quotes || []) {
    const paths = parsePaths(q.file_url as string)
    if (paths.length === 0) continue
    const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove(paths)
    if (!rmErr) deletedFiles += paths.length
    // 파일 정보 제거 (재처리 방지 + UI에서 다운로드 숨김)
    await supabaseAdmin.from('quotes').update({ file_url: null, file_name: null }).eq('id', q.id)
    processedQuotes += 1
  }

  return NextResponse.json({ ok: true, processedQuotes, deletedFiles, cutoff })
}
