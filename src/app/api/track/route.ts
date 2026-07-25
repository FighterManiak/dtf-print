export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 유입 경로 분류
function classifyReferrer(ref: string, host: string): string {
  if (!ref) return '직접 유입'
  try {
    const u = new URL(ref)
    const h = u.hostname.replace(/^www\./, '')
    if (h === host.replace(/^www\./, '')) return '내부 이동'
    if (/google\./.test(h)) return '구글 검색'
    if (/naver\./.test(h)) return '네이버'
    if (/daum\.|kakao\./.test(h)) return '다음/카카오'
    if (/instagram\./.test(h)) return '인스타그램'
    if (/facebook\./.test(h)) return '페이스북'
    if (/youtube\./.test(h)) return '유튜브'
    return h
  } catch {
    return '기타'
  }
}

// referrer URL에서 검색 키워드 추출 (넘어오는 경우에만)
function extractKeyword(ref: string): string | null {
  if (!ref) return null
  try {
    const u = new URL(ref)
    // 검색엔진별 검색어 파라미터
    const params = ['q', 'query', 'wd', 'text', 'keyword', 'search_query']
    for (const p of params) {
      const v = u.searchParams.get(p)
      if (v && v.trim()) return v.trim().slice(0, 100)
    }
    return null
  } catch {
    return null
  }
}

// 방문 기록 (비식별 해시로 방문자 구분)
export async function POST(req: Request) {
  try {
    const { path, referrer } = await req.json()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ua = req.headers.get('user-agent') || ''
    const host = req.headers.get('host') || ''

    // 봇 제외
    if (/bot|crawler|spider|crawling|preview|slurp/i.test(ua)) {
      return NextResponse.json({ skipped: true })
    }

    // IP+UA+날짜를 해시 → 개인정보 저장 없이 일별 순방문자 구분
    // 한국시간(KST, UTC+9) 기준 날짜
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const visitorHash = crypto.createHash('sha256').update(`${ip}|${ua}|${today}`).digest('hex').slice(0, 32)

    const { error } = await supabaseAdmin.from('visits').insert({
      path: (path || '/').slice(0, 300),
      visitor_hash: visitorHash,
      referrer_type: classifyReferrer(referrer || '', host),
      search_keyword: extractKeyword(referrer || ''),
      visit_date: today,
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
