export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ymd = (d: Date) => d.toISOString().slice(0, 10)

type Row = { visit_date: string; visitor_hash: string; referrer_type: string }

// 특정 행 집합에서 UV(순방문자)/PV(페이지뷰)/유입경로 집계
function aggregate(rows: Row[]) {
  const uv = new Set<string>()
  let pv = 0
  const referrerCount: Record<string, number> = {}
  rows.forEach((r) => {
    uv.add(r.visitor_hash)
    pv += 1
    const ref = r.referrer_type || '직접 유입'
    if (ref !== '내부 이동') referrerCount[ref] = (referrerCount[ref] || 0) + 1
  })
  const referrers = Object.entries(referrerCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  return { uv: uv.size, pv, referrers }
}

export async function GET() {
  // 한국시간(KST, UTC+9) 기준 — 저장 시점과 동일한 기준으로 집계
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  const today = ymd(now)
  const yesterday = ymd(new Date(now.getTime() - 86400000))
  const day7 = ymd(new Date(now.getTime() - 6 * 86400000))
  const day30 = ymd(new Date(now.getTime() - 29 * 86400000))

  // 전체 방문 기록 — Supabase 1000행 제한 때문에 페이지네이션으로 전체 조회
  const rows: Row[] = []
  const CHUNK = 1000
  for (let from = 0; from < 500000; from += CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('visits')
      .select('visit_date, visitor_hash, referrer_type')
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < CHUNK) break
  }

  // 기간별 필터
  const inRange = (from: string) => rows.filter((r) => r.visit_date >= from)
  const todayRows = rows.filter((r) => r.visit_date === today)
  const yesterdayRows = rows.filter((r) => r.visit_date === yesterday)
  const week = inRange(day7)
  const month = inRange(day30)

  // 최근 30일 일별 추이 (UV/PV)
  const byDate: Record<string, { uv: Set<string>; pv: number }> = {}
  for (let i = 29; i >= 0; i--) {
    byDate[ymd(new Date(now.getTime() - i * 86400000))] = { uv: new Set(), pv: 0 }
  }
  month.forEach((r) => {
    const b = byDate[r.visit_date]
    if (b) { b.uv.add(r.visitor_hash); b.pv += 1 }
  })
  const daily = Object.entries(byDate).map(([date, v]) => ({ date, uv: v.uv.size, pv: v.pv }))

  return NextResponse.json({
    periods: {
      today: aggregate(todayRows),
      yesterday: aggregate(yesterdayRows),
      last7: aggregate(week),
      last30: aggregate(month),
      all: aggregate(rows),
    },
    totalRecords: rows.length,
    daily,
  })
}
