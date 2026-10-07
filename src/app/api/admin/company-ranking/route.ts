export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { normCompany } from '@/lib/company'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Row = Record<string, unknown>
type Source = 'print' | 'material'

// 대시보드 매출과 같은 기준: 결제완료 이후 상태이면서 후불 미입금이 아닌 건
const REVENUE = ['paid', 'in_progress', 'shipped', 'delivered']
const isRevenue = (r: Row) => REVENUE.includes(String(r.status || '')) && r.is_paid !== false

const MONTH_RE = /^\d{4}-\d{2}$/
const kstMonthNow = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7)
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
const monthStartIso = (ym: string) => new Date(`${ym}-01T00:00:00+09:00`).toISOString()
const kstMonthOf = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7)
const kstDateOf = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)

const digits = (s: unknown) => String(s || '').replace(/\D/g, '')

async function fetchRange(source: Source, gte: string, lt: string) {
  const table = source === 'print' ? 'orders' : 'material_orders'
  const rows: Row[] = []
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id,order_no,user_id,user_name,user_phone,total_amount,status,is_paid,memo,created_at')
      .gte('created_at', gte).lt('created_at', lt)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    data.forEach((r) => rows.push({ ...r, _source: source }))
    if (data.length < 1000) break
  }
  return rows
}

async function loadCompanies() {
  const map: Record<string, { company: string; name: string }> = {}
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    users.forEach((u) => {
      map[u.id] = {
        company: String(u.user_metadata?.company || '').trim(),
        name: String(u.user_metadata?.full_name || u.user_metadata?.name || '').trim(),
      }
    })
    if (users.length < 1000) break
  }
  return map
}

interface Group {
  key: string
  label: string
  hasCompany: boolean
  contact: string
  phone: string
  orderCount: number
  amount: number
  printAmount: number
  materialAmount: number
  orders: { orderNo: string | null; date: string; amount: number; source: Source }[]
}

// 관리자: 월별 업체별 주문금액 순위
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const month = MONTH_RE.test(sp.get('month') || '') ? sp.get('month')! : kstMonthNow()
  const sourceParam = sp.get('source')
  const sources: Source[] = sourceParam === 'print' ? ['print'] : sourceParam === 'material' ? ['material'] : ['print', 'material']
  const prevMonth = shiftMonth(month, -1)

  // 전월 1일 ~ 당월 말일까지 한 번에 조회해 두 달을 함께 집계
  const gte = monthStartIso(prevMonth)
  const lt = monthStartIso(shiftMonth(month, 1))

  let rows: Row[] = []
  try {
    for (const s of sources) rows = rows.concat(await fetchRange(s, gte, lt))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
  const members = await loadCompanies()

  // 업체 판별: 회원 회사명 → 전화주문 [업체] 표기 → 회원 ID → 전화번호 → 이름
  const identify = (r: Row) => {
    const uid = String(r.user_id || '')
    const member = uid ? members[uid] : undefined
    const memoCompany = String(r.memo || '').match(/\[업체\]\s*([^·|\n]+)/)?.[1]?.trim() || ''
    const company = member?.company || memoCompany
    const name = String(r.user_name || member?.name || '').trim()
    const ph = digits(r.user_phone)

    if (company) return { key: `c:${normCompany(company)}`, label: company, hasCompany: true, name, ph }
    if (uid) return { key: `u:${uid}`, label: name || '(이름 없음)', hasCompany: false, name, ph }
    if (ph) return { key: `p:${ph}`, label: name || ph, hasCompany: false, name, ph }
    return { key: `n:${name}`, label: name || '(이름 없음)', hasCompany: false, name, ph }
  }

  const build = (target: string) => {
    const groups = new Map<string, Group>()
    rows.forEach((r) => {
      if (!isRevenue(r)) return
      if (kstMonthOf(String(r.created_at)) !== target) return
      const id = identify(r)
      const amount = Number(r.total_amount) || 0
      const src = r._source as Source
      let g = groups.get(id.key)
      if (!g) {
        g = { key: id.key, label: id.label, hasCompany: id.hasCompany, contact: id.name, phone: id.ph, orderCount: 0, amount: 0, printAmount: 0, materialAmount: 0, orders: [] }
        groups.set(id.key, g)
      }
      g.orderCount += 1
      g.amount += amount
      if (src === 'print') g.printAmount += amount; else g.materialAmount += amount
      if (!g.contact && id.name) g.contact = id.name
      if (!g.phone && id.ph) g.phone = id.ph
      g.orders.push({ orderNo: (r.order_no as string) || null, date: kstDateOf(String(r.created_at)), amount, source: src })
    })
    return [...groups.values()].sort((a, b) => b.amount - a.amount || b.orderCount - a.orderCount)
  }

  const current = build(month)
  const previous = build(prevMonth)
  const prevRank = new Map(previous.map((g, i) => [g.key, { rank: i + 1, amount: g.amount }]))

  const total = current.reduce((s, g) => s + g.amount, 0)
  const prevTotal = previous.reduce((s, g) => s + g.amount, 0)

  const ranking = current.map((g, i) => {
    const p = prevRank.get(g.key)
    return {
      rank: i + 1,
      key: g.key,
      label: g.label,
      hasCompany: g.hasCompany,
      contact: g.contact,
      phone: g.phone,
      orderCount: g.orderCount,
      amount: g.amount,
      printAmount: g.printAmount,
      materialAmount: g.materialAmount,
      share: total ? g.amount / total : 0,
      prevRank: p?.rank ?? null,
      prevAmount: p?.amount ?? 0,
      orders: g.orders.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50),
    }
  })

  return NextResponse.json({
    month,
    prevMonth,
    source: sourceParam === 'print' || sourceParam === 'material' ? sourceParam : 'all',
    totals: { amount: total, orders: current.reduce((s, g) => s + g.orderCount, 0), companies: current.length },
    prevTotals: { amount: prevTotal, companies: previous.length },
    ranking,
  })
}
