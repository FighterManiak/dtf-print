export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export async function GET() {
  // 한국시간(KST, UTC+9) 기준 — 저장 시점과 동일한 기준으로 집계
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const today = ymd(now)
  const yesterday = ymd(new Date(now.getTime() - 86400000))
  const weekAgo = ymd(new Date(now.getTime() - 6 * 86400000))

  // 최근 7일치 방문 기록 — Supabase 1000행 제한 때문에 페이지네이션으로 전체 조회
  const rows: { visit_date: string; visitor_hash: string; referrer_type: string }[] = []
  const CHUNK = 1000
  for (let from = 0; from < 100000; from += CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('visits')
      .select('visit_date, visitor_hash, referrer_type')
      .gte('visit_date', weekAgo)
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < CHUNK) break
  }

  // 일별 집계 (UV = 순방문자, PV = 페이지뷰)
  const byDate: Record<string, { uv: Set<string>; pv: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = ymd(new Date(now.getTime() - i * 86400000))
    byDate[d] = { uv: new Set(), pv: 0 }
  }
  const referrerCount: Record<string, number> = {}

  rows.forEach((r) => {
    const d = r.visit_date as string
    if (byDate[d]) {
      byDate[d].uv.add(r.visitor_hash as string)
      byDate[d].pv += 1
    }
    const ref = (r.referrer_type as string) || '직접 유입'
    if (ref !== '내부 이동') referrerCount[ref] = (referrerCount[ref] || 0) + 1
  })

  const daily = Object.entries(byDate).map(([date, v]) => ({ date, uv: v.uv.size, pv: v.pv }))
  const referrers = Object.entries(referrerCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({
    today: { uv: byDate[today]?.uv.size || 0, pv: byDate[today]?.pv || 0 },
    yesterday: { uv: byDate[yesterday]?.uv.size || 0, pv: byDate[yesterday]?.pv || 0 },
    daily,
    referrers,
  })
}
