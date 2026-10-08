export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Row = Record<string, unknown>
type Source = 'print' | 'material' | 'quote'

// 실제로 주문이 성립한 상태 (입금대기·취소·환불 제외). 후불 미입금도 주문으로 봄
const PLACED = ['paid', 'in_progress', 'shipped', 'delivered']
const isPlaced = (r: Row) => PLACED.includes(String(r.status || ''))

const digits = (v: unknown) => String(v || '').replace(/\D/g, '')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  return role === 'admin' || role === 'superadmin'
}

async function fetchAll(table: string, columns: string, apply?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: Row[] = []
  for (let from = 0; from < 300000; from += 1000) {
    let q = supabaseAdmin.from(table).select(columns).order('created_at', { ascending: false }).range(from, from + 999)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Row[]))
    if (data.length < 1000) break
  }
  return rows
}

// 회원 전화번호 → 회원 ID (회원과 연결되지 않은 전화주문을 전화번호로 찾기 위함)
async function phoneToUser(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const dup = new Set<string>()
  for (let page = 1; page <= 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    users.forEach((u) => {
      const ph = digits(u.user_metadata?.phone)
      if (ph.length < 10) return
      if (map.has(ph)) dup.add(ph); else map.set(ph, u.id)
    })
    if (users.length < 1000) break
  }
  dup.forEach((ph) => map.delete(ph)) // 같은 번호 회원이 둘 이상이면 판단하지 않음
  return map
}

const COLS = 'id,order_no,user_id,user_phone,total_amount,status,is_paid,created_at,order_name'

// 관리자: 회원별 주문 빈도
// - ?summary=1  : 회원 목록용 요약 (회원 ID → 주문 수·최근 주문일 등)
// - ?userId=    : 한 회원의 주문 목록 (견적 진행 중·자재 포함)
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const sp = new URL(req.url).searchParams

  try {
    const phones = await phoneToUser()

    // 주문 행 → 회원 ID (연결된 회원 우선, 없으면 전화번호 일치)
    const ownerOf = (r: Row): { uid: string | null; byPhone: boolean } => {
      const uid = String(r.user_id || '')
      if (uid) return { uid, byPhone: false }
      const p = phones.get(digits(r.user_phone))
      return p ? { uid: p, byPhone: true } : { uid: null, byPhone: false }
    }

    if (sp.get('summary')) {
      const [orders, mats] = await Promise.all([
        fetchAll('orders', COLS),
        fetchAll('material_orders', COLS),
      ])
      const now = Date.now()
      const DAY = 86400000
      const acc: Record<string, { dates: number[]; amount: number }> = {}
      ;[...orders, ...mats].forEach((r) => {
        if (!isPlaced(r)) return
        const { uid } = ownerOf(r)
        if (!uid) return
        const a = (acc[uid] ||= { dates: [], amount: 0 })
        a.dates.push(new Date(String(r.created_at)).getTime())
        a.amount += Number(r.total_amount) || 0
      })

      const summary: Record<string, {
        count: number; amount: number; lastAt: string; firstAt: string
        recent90: number; daysSinceLast: number; avgIntervalDays: number | null
      }> = {}
      Object.entries(acc).forEach(([uid, a]) => {
        const ds = a.dates.sort((x, y) => x - y)
        const first = ds[0], last = ds[ds.length - 1]
        summary[uid] = {
          count: ds.length,
          amount: a.amount,
          firstAt: new Date(first).toISOString(),
          lastAt: new Date(last).toISOString(),
          recent90: ds.filter((t) => now - t <= 90 * DAY).length,
          daysSinceLast: Math.floor((now - last) / DAY),
          avgIntervalDays: ds.length >= 2 ? Math.round((last - first) / DAY / (ds.length - 1)) : null,
        }
      })
      return NextResponse.json({ summary })
    }

    const userId = sp.get('userId') || ''
    if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

    // 이 회원 앞으로 연결된 주문 + 전화번호가 같은 미연결 주문
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId)
    const myPhone = digits(u?.user?.user_metadata?.phone)
    const phoneOwned = myPhone.length >= 10 && phones.get(myPhone) === userId

    const load = async (table: string) => {
      const linked = await fetchAll(table, COLS, (q) => q.eq('user_id', userId))
      const byPhone = phoneOwned
        ? (await fetchAll(table, COLS, (q) => q.is('user_id', null))).filter((r) => digits(r.user_phone) === myPhone)
        : []
      return [...linked.map((r) => ({ r, byPhone: false })), ...byPhone.map((r) => ({ r, byPhone: true }))]
    }

    const [orders, mats, quotes] = await Promise.all([
      load('orders'),
      load('material_orders'),
      // 아직 결제 전인 견적 (결제되면 주문으로 넘어가 위 목록에 들어감)
      fetchAll('quotes', 'id,order_no,user_id,status,total_amount,created_at,order_name,order_id,product_type',
        (q) => q.eq('user_id', userId).is('order_id', null)),
    ])

    const item = (r: Row, source: Source, byPhone: boolean) => ({
      id: r.id as string,
      orderNo: (r.order_no as string) || null,
      source,
      createdAt: r.created_at as string,
      status: (r.status as string) || null,
      placed: source !== 'quote' && isPlaced(r),
      unpaid: r.is_paid === false,
      amount: Number(r.total_amount) || 0,
      orderName: (r.order_name as string) || null,
      byPhone,
    })

    const list = [
      ...orders.map(({ r, byPhone }) => item(r, 'print', byPhone)),
      ...mats.map(({ r, byPhone }) => item(r, 'material', byPhone)),
      ...quotes.filter((q) => !['cancelled', 'rejected'].includes(String(q.status))).map((r) => item(r, 'quote', false)),
    ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

    return NextResponse.json({ orders: list })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 })
  }
}
