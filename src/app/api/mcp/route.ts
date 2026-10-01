export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

// ─────────────────────────────────────────────────────────────
// 그룹웨어 연동용 MCP 서버 (Streamable HTTP · 상태 없음 · JSON 응답)
// 인증: Authorization: Bearer <MCP_TOKEN>
// 제공: 무통장 입금 내역 / 입금자 검색 / 증빙 요청 목록 / 주문 상세 / 발행 완료 기록
// ─────────────────────────────────────────────────────────────

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'superhard', title: 'SUPER HARD 주문·증빙', version: '1.0.0' }
const INSTRUCTIONS = [
  'SUPER HARD(DTF 출력·자재 쇼핑몰)의 무통장 입금 주문과 세금계산서·현금영수증 요청을 조회합니다.',
  '금액(totalAmount)은 부가세 포함 총액입니다.',
  '주문번호가 M으로 시작하면 자재 주문, 그 외(숫자·Q)는 출력 주문입니다.',
  '날짜 인자는 한국시간 기준 YYYY-MM-DD 입니다.',
  '증빙을 발행했으면 mark_receipt_issued 로 기록해 중복 발행을 막으세요.',
].join('\n')

// ── 인증 ──────────────────────────────────────────────────────
function authorized(req: Request): boolean {
  // Vercel 화면에 붙여넣을 때 섞여 들어간 앞뒤 공백·줄바꿈은 무시
  const expected = (process.env.MCP_TOKEN || '').trim()
  if (!expected) return false
  const h = req.headers.get('authorization') || ''
  const got = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── 공통 유틸 ─────────────────────────────────────────────────
type Row = Record<string, unknown>
type Source = 'print' | 'material'
const TABLE: Record<Source, string> = { print: 'orders', material: 'material_orders' }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const toKst = (iso: unknown): string | null => {
  if (!iso) return null
  const t = new Date(String(iso)).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00')
}

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const shiftDate = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// 날짜 범위 (기본: 최근 defaultDays일)
function range(args: Row, defaultDays: number) {
  const to = typeof args.to === 'string' && DATE_RE.test(args.to) ? args.to : kstToday()
  const from = typeof args.from === 'string' && DATE_RE.test(args.from) ? args.from : shiftDate(to, -defaultDays)
  if (from > to) throw new ToolError('from 이 to 보다 늦습니다.')
  return {
    from, to,
    gte: new Date(`${from}T00:00:00+09:00`).toISOString(),
    lte: new Date(`${to}T23:59:59.999+09:00`).toISOString(),
  }
}

const sourcesOf = (args: Row): Source[] =>
  args.source === 'print' ? ['print'] : args.source === 'material' ? ['material'] : ['print', 'material']

const limitOf = (args: Row, def = 200) => Math.min(1000, Math.max(1, Math.round(Number(args.limit) || def)))

// 결제 완료 여부: 입금대기·취소·환불이 아니고 후불 미입금도 아닌 건
const isPaidRow = (r: Row) =>
  !['pending', 'cancelled', 'refunded'].includes(String(r.status || '')) && r.is_paid !== false

// 무통장 여부 (과거 견적 무통장 주문은 결제수단이 비어 있고 메모에만 기록됨)
const isBankRow = (r: Row) =>
  r.payment_method === 'bank_transfer' || (!r.payment_method && String(r.memo || '').startsWith('무통장'))

const sourceOfOrderNo = (orderNo: string): Source => (orderNo.toUpperCase().startsWith('M') ? 'material' : 'print')

class ToolError extends Error {}

// 회원 ID → 회사명 (요청 1회 동안만 캐시)
async function loadCompanies(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  for (let page = 1; page <= 100; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users || []
    users.forEach((u) => {
      const c = String(u.user_metadata?.company || '').trim()
      if (c) map[u.id] = c
    })
    if (users.length < 1000) break
  }
  return map
}

const companyOf = (r: Row, companies: Record<string, string>) => {
  const uid = String(r.user_id || '')
  if (uid && companies[uid]) return companies[uid]
  return String(r.memo || '').match(/\[업체\]\s*([^·|\n]+)/)?.[1]?.trim() || null
}

function summarize(r: Row, source: Source, companies: Record<string, string>) {
  const pm = isBankRow(r) ? 'bank_transfer' : r.payment_method === 'CARD' ? 'card' : (r.payment_method ?? null)
  return {
    orderNo: (r.order_no as string) ?? null,
    source,
    orderedAt: toKst(r.created_at),
    status: r.status ?? null,
    isPaid: isPaidRow(r),
    orderer: (r.user_name as string) ?? null,
    company: companyOf(r, companies),
    phone: (r.user_phone as string) ?? null,
    paymentMethod: pm,
    depositorName: pm === 'bank_transfer' ? ((r.depositor_name as string) || (r.user_name as string) || null) : null,
    totalAmount: Number(r.total_amount) || 0,
    orderName: (r.order_name as string) ?? null,
    receiptType: (r.receipt_type as string) ?? null,
    receiptInfo: (r.receipt_info as Row) ?? null,
    receiptIssuedAt: toKst(r.receipt_issued_at),
    receiptDocNo: (r.receipt_doc_no as string) ?? null,
  }
}

// DB 오류를 사람이 이해할 수 있는 메시지로
function dbError(msg: string): never {
  if (/receipt_issued_at|receipt_doc_no|depositor_name|receipt_type|receipt_info/.test(msg)) {
    throw new ToolError(`DB 컬럼이 아직 없습니다. 사이트 관리자에게 supabase-depositor.sql 실행을 요청하세요. (${msg})`)
  }
  throw new ToolError(`조회 실패: ${msg}`)
}

// 무통장 주문 조회 (결제수단 기록이 없는 과거 견적 무통장 건까지 포함)
async function fetchBankRows(source: Source, gte: string, lte: string, limit: number) {
  const base = () => admin.from(TABLE[source]).select('*')
    .gte('created_at', gte).lte('created_at', lte)
    .order('created_at', { ascending: false }).limit(limit)

  const { data: a, error: e1 } = await base().eq('payment_method', 'bank_transfer')
  if (e1) dbError(e1.message)
  let rows = (a || []) as Row[]

  if (source === 'print') {
    const { data: b, error: e2 } = await base().is('payment_method', null).ilike('memo', '무통장%')
    if (e2) dbError(e2.message)
    rows = rows.concat((b || []) as Row[])
  }
  return rows
}

const byDateDesc = (x: { orderedAt: string | null }, y: { orderedAt: string | null }) =>
  String(y.orderedAt || '').localeCompare(String(x.orderedAt || ''))

// ── 도구 정의 ─────────────────────────────────────────────────
const dateProp = (desc: string) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: desc })
const sourceProp = { type: 'string', enum: ['all', 'print', 'material'], default: 'all', description: 'print=출력 주문, material=자재 주문' }
const limitProp = { type: 'integer', minimum: 1, maximum: 1000, default: 200 }

const TOOLS = [
  {
    name: 'list_bank_deposits',
    title: '무통장 입금 주문 목록',
    description: '기간 내 무통장 입금 주문을 입금자명·금액·입금 여부·증빙 유형과 함께 반환합니다. 통장 내역과 대조할 때 사용합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        from: dateProp('시작일 (기본: 종료일 30일 전)'),
        to: dateProp('종료일 (기본: 오늘)'),
        paid: { type: 'string', enum: ['all', 'paid', 'unpaid'], default: 'all', description: 'paid=입금 확인됨, unpaid=입금 대기' },
        source: sourceProp,
        includeCancelled: { type: 'boolean', default: false, description: '취소·환불 건 포함 여부' },
        limit: limitProp,
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'find_by_depositor',
    title: '입금자명으로 주문 찾기',
    description: '통장에 찍힌 입금자명(일부만 입력해도 됨)으로 무통장 주문을 찾습니다. 입금자명·주문자명·업체명을 모두 검색하며, 금액을 주면 금액이 같은 건을 앞에 둡니다.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, description: '통장 내역의 입금자명' },
        amount: { type: 'integer', minimum: 0, description: '입금 금액 (선택)' },
        from: dateProp('시작일 (기본: 종료일 60일 전)'),
        to: dateProp('종료일 (기본: 오늘)'),
        source: sourceProp,
      },
      required: ['name'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_receipt_requests',
    title: '증빙 발행 요청 목록',
    description: '세금계산서·현금영수증 발행을 요청한 주문을 발행 정보(사업자번호·상호·대표자·이메일 / 현금영수증 번호)와 함께 반환합니다. 기본값은 입금이 확인됐고 아직 발행하지 않은 건입니다.',
    inputSchema: {
      type: 'object',
      properties: {
        from: dateProp('시작일 (기본: 종료일 90일 전)'),
        to: dateProp('종료일 (기본: 오늘)'),
        status: { type: 'string', enum: ['pending', 'issued', 'all'], default: 'pending', description: 'pending=미발행, issued=발행 완료' },
        type: { type: 'string', enum: ['all', 'tax_invoice', 'cash_receipt'], default: 'all' },
        paidOnly: { type: 'boolean', default: true, description: '입금 확인된 건만' },
        source: sourceProp,
        limit: limitProp,
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_order',
    title: '주문 상세',
    description: '주문번호로 주문 1건의 상세(품목·주소·이메일·메모·증빙 정보)를 반환합니다.',
    inputSchema: {
      type: 'object',
      properties: { orderNo: { type: 'string', minLength: 1, description: '예: 261001-010, Q261001-001, M261001-002' } },
      required: ['orderNo'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'mark_receipt_issued',
    title: '증빙 발행 완료 기록',
    description: '세금계산서·현금영수증을 발행했음을 주문에 기록합니다. 기록된 건은 list_receipt_requests(status=pending)에서 빠집니다. undo=true 로 기록을 취소할 수 있습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        orderNo: { type: 'string', minLength: 1 },
        docNo: { type: 'string', description: '승인번호·문서번호 (선택)' },
        issuedAt: { type: 'string', description: '발행일시 ISO 또는 YYYY-MM-DD (기본: 지금)' },
        undo: { type: 'boolean', default: false, description: 'true 면 발행 기록을 지움' },
      },
      required: ['orderNo'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
]

// ── 도구 실행 ─────────────────────────────────────────────────
async function listBankDeposits(args: Row) {
  const r = range(args, 30)
  const limit = limitOf(args)
  const companies = await loadCompanies()
  let out: ReturnType<typeof summarize>[] = []
  let truncated = false

  for (const s of sourcesOf(args)) {
    const rows = await fetchBankRows(s, r.gte, r.lte, limit)
    if (rows.length >= limit) truncated = true
    out = out.concat(rows.map((x) => summarize(x, s, companies)))
  }

  if (!args.includeCancelled) out = out.filter((o) => !['cancelled', 'refunded'].includes(String(o.status)))
  if (args.paid === 'paid') out = out.filter((o) => o.isPaid)
  if (args.paid === 'unpaid') out = out.filter((o) => !o.isPaid)
  out.sort(byDateDesc)
  out = out.slice(0, limit)

  return {
    range: { from: r.from, to: r.to },
    count: out.length,
    totalAmount: out.reduce((s, o) => s + o.totalAmount, 0),
    truncated,
    orders: out,
  }
}

async function findByDepositor(args: Row) {
  const name = String(args.name || '').trim()
  if (!name) throw new ToolError('name 이 필요합니다.')
  const amount = args.amount != null ? Number(args.amount) : null
  const r = range(args, 60)
  const companies = await loadCompanies()

  const q = name.replace(/\s+/g, '').toLowerCase()
  const has = (v: unknown) => String(v || '').replace(/\s+/g, '').toLowerCase().includes(q)

  const matches: (ReturnType<typeof summarize> & { matchedOn: string[]; amountMatch: boolean | null })[] = []
  for (const s of sourcesOf(args)) {
    const rows = await fetchBankRows(s, r.gte, r.lte, 1000)
    rows.forEach((row) => {
      const sum = summarize(row, s, companies)
      const on: string[] = []
      if (has(row.depositor_name)) on.push('입금자명')
      if (has(row.user_name)) on.push('주문자명')
      if (has(sum.company)) on.push('업체명')
      if (on.length === 0) return
      matches.push({ ...sum, matchedOn: on, amountMatch: amount == null ? null : sum.totalAmount === amount })
    })
  }

  // 금액 일치 → 미입금 → 최신 순
  matches.sort((a, b) =>
    Number(b.amountMatch === true) - Number(a.amountMatch === true) ||
    Number(a.isPaid) - Number(b.isPaid) ||
    byDateDesc(a, b))

  return { query: { name, amount, from: r.from, to: r.to }, count: matches.length, orders: matches.slice(0, 100) }
}

async function listReceiptRequests(args: Row) {
  const r = range(args, 90)
  const limit = limitOf(args)
  const status = args.status === 'issued' || args.status === 'all' ? args.status : 'pending'
  const paidOnly = args.paidOnly !== false
  const companies = await loadCompanies()

  let out: ReturnType<typeof summarize>[] = []
  let truncated = false
  for (const s of sourcesOf(args)) {
    // 조건부로 필터를 이어 붙이면 PostgREST 제네릭 추론이 폭주해 타입을 느슨하게 둠
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from(TABLE[s]).select('*')
      .not('receipt_type', 'is', null)
      .gte('created_at', r.gte).lte('created_at', r.lte)
      .not('status', 'in', '(cancelled,refunded)')
      .order('created_at', { ascending: false }).limit(limit)
    if (args.type === 'tax_invoice' || args.type === 'cash_receipt') q = q.eq('receipt_type', args.type)
    if (status === 'pending') q = q.is('receipt_issued_at', null)
    if (status === 'issued') q = q.not('receipt_issued_at', 'is', null)

    const { data, error } = await q
    if (error) dbError(error.message)
    const rows = (data || []) as Row[]
    if (rows.length >= limit) truncated = true
    out = out.concat(rows.map((x) => summarize(x, s, companies)))
  }

  if (paidOnly) out = out.filter((o) => o.isPaid)
  out.sort(byDateDesc)
  out = out.slice(0, limit)

  return {
    range: { from: r.from, to: r.to },
    filter: { status, type: args.type || 'all', paidOnly },
    count: out.length,
    taxInvoiceCount: out.filter((o) => o.receiptType === 'tax_invoice').length,
    cashReceiptCount: out.filter((o) => o.receiptType === 'cash_receipt').length,
    truncated,
    orders: out,
  }
}

async function findOrderRow(orderNo: string): Promise<{ row: Row; source: Source }> {
  const no = orderNo.trim()
  if (!no) throw new ToolError('orderNo 가 필요합니다.')
  const source = sourceOfOrderNo(no)
  const { data, error } = await admin.from(TABLE[source]).select('*').eq('order_no', no).order('created_at', { ascending: false }).limit(1)
  if (error) dbError(error.message)
  const row = (data || [])[0] as Row | undefined
  if (!row) throw new ToolError(`주문번호 ${no} 를 찾을 수 없습니다.`)
  return { row, source }
}

async function getOrder(args: Row) {
  const { row, source } = await findOrderRow(String(args.orderNo || ''))
  const companies = await loadCompanies()

  let items: { name: string; quantity: number; unit: string | null; unitPrice: number }[] = []
  if (source === 'print') {
    const { data: oi } = await admin.from('order_items').select('product_id,quantity,unit_price').eq('order_id', row.id as string)
    const ids = [...new Set((oi || []).map((x) => x.product_id as string))]
    const { data: prods } = ids.length ? await admin.from('products').select('id,name,unit').in('id', ids) : { data: [] }
    const pm = new Map((prods || []).map((p) => [p.id as string, p]))
    items = (oi || []).map((x) => ({
      name: (pm.get(x.product_id as string)?.name as string) || (x.product_id as string),
      quantity: Number(x.quantity) || 0,
      unit: (pm.get(x.product_id as string)?.unit as string) || null,
      unitPrice: Number(x.unit_price) || 0,
    }))
  } else {
    const list = Array.isArray(row.items) ? (row.items as Row[]) : []
    items = list.map((x) => ({ name: String(x.name || ''), quantity: Number(x.qty) || 0, unit: null, unitPrice: Number(x.price) || 0 }))
  }

  return {
    ...summarize(row, source, companies),
    email: (row.user_email as string) ?? null,
    address: (row.user_address as string) ?? null,
    memo: (row.memo as string) ?? null,
    carrier: (row.carrier as string) ?? null,
    trackingNumber: (row.tracking_number as string) ?? null,
    items,
  }
}

async function markReceiptIssued(args: Row) {
  const { row, source } = await findOrderRow(String(args.orderNo || ''))
  const undo = args.undo === true

  let issuedAt: string | null = null
  if (!undo) {
    const raw = typeof args.issuedAt === 'string' ? args.issuedAt.trim() : ''
    const d = raw ? new Date(DATE_RE.test(raw) ? `${raw}T09:00:00+09:00` : raw) : new Date()
    if (Number.isNaN(d.getTime())) throw new ToolError('issuedAt 형식이 올바르지 않습니다.')
    issuedAt = d.toISOString()
  }
  const docNo = undo ? null : (String(args.docNo || '').trim() || null)

  const previous = { receiptIssuedAt: toKst(row.receipt_issued_at), receiptDocNo: (row.receipt_doc_no as string) ?? null }
  const { error } = await admin.from(TABLE[source])
    .update({ receipt_issued_at: issuedAt, receipt_doc_no: docNo })
    .eq('id', row.id as string)
  if (error) dbError(error.message)

  return {
    orderNo: row.order_no,
    source,
    action: undo ? 'cleared' : 'issued',
    receiptType: row.receipt_type ?? null,
    receiptIssuedAt: toKst(issuedAt),
    receiptDocNo: docNo,
    previous,
    warning: !row.receipt_type ? '이 주문은 증빙 발행 요청이 없던 건입니다.' : undefined,
  }
}

const HANDLERS: Record<string, (args: Row) => Promise<unknown>> = {
  list_bank_deposits: listBankDeposits,
  find_by_depositor: findByDepositor,
  list_receipt_requests: listReceiptRequests,
  get_order: getOrder,
  mark_receipt_issued: markReceiptIssued,
}

// ── JSON-RPC 처리 ─────────────────────────────────────────────
type RpcId = string | number
interface RpcMessage { jsonrpc?: string; id?: RpcId | null; method?: string; params?: Row }

const ok = (id: RpcId, result: unknown) => ({ jsonrpc: '2.0', id, result })
const fail = (id: RpcId | null, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

async function handle(m: RpcMessage) {
  const isRequest = m.id !== undefined && m.id !== null
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
    return isRequest ? fail(m.id as RpcId, -32600, 'Invalid Request') : null
  }
  if (!isRequest) return null // 알림(notifications/*)은 응답하지 않음
  const id = m.id as RpcId
  const params = (m.params || {}) as Row

  switch (m.method) {
    case 'initialize': {
      const requested = String(params.protocolVersion || '')
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: TOOLS })
    case 'tools/call': {
      const name = String(params.name || '')
      const fn = HANDLERS[name]
      if (!fn) return fail(id, -32602, `알 수 없는 도구: ${name}`)
      try {
        const result = await fn((params.arguments || {}) as Row)
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        })
      } catch (e) {
        // 도구 실행 오류는 결과로 돌려줘 모델이 내용을 보고 대응하게 함
        const msg = e instanceof ToolError ? e.message : `처리 중 오류: ${e instanceof Error ? e.message : String(e)}`
        return ok(id, { content: [{ type: 'text', text: msg }], isError: true })
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${m.method}`)
  }
}

export async function POST(req: Request) {
  if (!(process.env.MCP_TOKEN || '').trim()) {
    return NextResponse.json(fail(null, -32000, 'MCP_TOKEN 이 설정되지 않았습니다.'), { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json(fail(null, -32001, 'Unauthorized'), {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="superhard-mcp"' },
    })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(fail(null, -32700, 'Parse error'), { status: 400 })
  }

  const batch = Array.isArray(body)
  const messages = (batch ? body : [body]) as RpcMessage[]
  const responses = (await Promise.all(messages.map(handle))).filter(Boolean)

  // 알림·응답만 온 경우
  if (responses.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(batch ? responses : responses[0])
}

// 상태 없는 서버라 서버→클라이언트 스트림(GET)과 세션 종료(DELETE)는 지원하지 않음
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
