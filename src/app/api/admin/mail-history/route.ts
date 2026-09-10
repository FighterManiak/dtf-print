export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자: 메일 발송 히스토리 조회
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const type = sp.get('type') || ''
  const q = (sp.get('q') || '').trim()
  const from = sp.get('from') || ''
  const to = sp.get('to') || ''
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit')) || 100))
  const offset = Math.max(0, Number(sp.get('offset')) || 0)

  let query = supabaseAdmin
    .from('email_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)
  if (q) {
    // 검색 시 와일드카드 문자를 이스케이프
    const safe = q.replace(/[%_]/g, (m) => `\\${m}`)
    query = query.or(`subject.ilike.%${safe}%,recipient.ilike.%${safe}%,sent_by.ilike.%${safe}%`)
  }
  if (from) query = query.gte('created_at', new Date(`${from}T00:00:00+09:00`).toISOString())
  if (to) query = query.lte('created_at', new Date(`${to}T23:59:59+09:00`).toISOString())

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data || [], total: count ?? 0 })
}
