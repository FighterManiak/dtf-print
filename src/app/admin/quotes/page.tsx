'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, CheckCircle, Clock, CreditCard, XCircle, ChevronDown, ChevronUp, Send, Truck, Package, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  A4: 'A4 출력', A3: 'A3 출력', roll_58: '58cm 롤 출력', other: '기타',
}

// 통합 상태 설정
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:               { label: '검토 대기',   color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  quoted:                { label: '견적 발송',   color: 'bg-blue-100 text-blue-700',     icon: CheckCircle },
  bank_transfer_pending: { label: '입금 확인중', color: 'bg-orange-100 text-orange-700', icon: Clock },
  order_pending:         { label: '입금 대기',   color: 'bg-orange-100 text-orange-700', icon: Clock },
  paid:                  { label: '결제 완료',   color: 'bg-green-100 text-green-700',   icon: CreditCard },
  in_progress:           { label: '작업 중',     color: 'bg-yellow-100 text-yellow-800', icon: Package },
  shipped:               { label: '출고 완료',   color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered:             { label: '배송 완료',   color: 'bg-green-100 text-green-800',   icon: CheckCircle },
  refund_requested:      { label: '환불 요청',   color: 'bg-red-100 text-red-600',       icon: RotateCcw },
  refunded:              { label: '환불 완료',   color: 'bg-gray-100 text-gray-500',     icon: RotateCcw },
  cancelled:             { label: '취소',        color: 'bg-red-100 text-red-500',       icon: XCircle },
}

const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배', '쿠팡로켓', '기타']

interface OrderInfo {
  id: string
  status: string
  carrier: string | null
  tracking_number: string | null
  refund_reason: string | null
}

interface Quote {
  id: string
  created_at: string
  status: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  user_address: string | null
  product_type: string
  order_name: string | null
  request_note: string | null
  file_url: string | null
  file_name: string | null
  quoted_quantity: number | null
  quoted_unit: string | null
  cutting: boolean
  cutting_price: number
  unit_price: number | null
  total_amount: number | null
  admin_note: string | null
  order_id: string | null
  order?: OrderInfo | null
}

interface DirectOrder {
  id: string
  created_at: string
  status: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  user_address: string | null
  order_name: string | null
  total_amount: number
  carrier: string | null
  tracking_number: string | null
  memo: string | null
  refund_reason: string | null
  order_items: {
    id: string
    product_id: string
    quantity: number
    unit_price: number
    cutting: boolean
    cutting_price: number
    request_note: string | null
  }[]
}

type Item = { type: 'quote'; data: Quote } | { type: 'order'; data: DirectOrder }

interface QuoteForm {
  quantity: string; unit: string; unitPrice: string
  cutting: boolean; cuttingPrice: string; adminNote: string
}

// 통합 상태 탭
const TABS = [
  { key: 'all',                label: '전체' },
  { key: 'pending',            label: '검토 대기' },
  { key: 'quoted',             label: '견적 발송' },
  { key: 'bank_transfer_pending', label: '입금 확인' },
  { key: 'order_pending',      label: '바로주문 입금' },
  { key: 'paid',               label: '결제 완료' },
  { key: 'in_progress',        label: '작업 중' },
  { key: 'shipped',            label: '출고' },
  { key: 'delivered',          label: '배송 완료' },
  { key: 'refund_requested',   label: '환불 요청' },
  { key: 'cancelled',          label: '취소' },
] as const

function getEffectiveStatus(item: Item): string {
  if (item.type === 'quote') {
    const q = item.data
    if (q.order) return q.order.status
    return q.status
  }
  const o = item.data
  return o.status === 'pending' ? 'order_pending' : o.status
}

export default function AdminManagePage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, QuoteForm>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const supabase = createClient()

    // 견적 목록
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })

    // 견적에 연결된 주문 정보 조회
    const orderIds = (quotesData || []).map((q) => q.order_id).filter(Boolean) as string[]
    let ordersMap: Record<string, OrderInfo> = {}
    if (orderIds.length > 0) {
      const { data: linkedOrders } = await supabase
        .from('orders')
        .select('id, status, carrier, tracking_number, refund_reason')
        .in('id', orderIds)
      if (linkedOrders) linkedOrders.forEach((o) => { ordersMap[o.id] = o })
    }

    const quoteItems: Item[] = (quotesData || []).map((q) => ({
      type: 'quote' as const,
      data: { ...q, order: q.order_id ? (ordersMap[q.order_id] ?? null) : null },
    }))

    // 바로 주문 (quote와 연결 안 된 orders)
    const linkedOrderIdSet = new Set(orderIds)
    const { data: directOrdersData } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })

    const directItems: Item[] = (directOrdersData || [])
      .filter((o) => !linkedOrderIdSet.has(o.id))
      .map((o) => ({ type: 'order' as const, data: o }))

    // 날짜순 병합
    const merged = [...quoteItems, ...directItems].sort(
      (a, b) => new Date(b.type === 'quote' ? b.data.created_at : b.data.created_at).getTime()
             - new Date(a.type === 'quote' ? a.data.created_at : a.data.created_at).getTime()
    )
    setItems(merged)
    setLoading(false)
  }

  // ── 견적 폼 헬퍼 ──
  const getForm = (id: string): QuoteForm =>
    forms[id] || { quantity: '', unit: 'M', unitPrice: '', cutting: false, cuttingPrice: '', adminNote: '' }
  const setForm = (id: string, patch: Partial<QuoteForm>) =>
    setForms((p) => ({ ...p, [id]: { ...getForm(id), ...patch } }))
  const calcTotal = (form: QuoteForm) => {
    const qty = parseFloat(form.quantity) || 0
    const price = parseInt(form.unitPrice) || 0
    const cut = form.cutting ? (parseInt(form.cuttingPrice) || 0) : 0
    return qty * price + cut
  }

  const sendQuote = async (quote: Quote) => {
    const form = getForm(quote.id)
    if (!form.quantity || !form.unitPrice) { alert('수량과 단가를 입력하세요.'); return }
    setSending(quote.id)
    const supabase = createClient()
    const total = calcTotal(form)
    const cuttingPrice = form.cutting ? (parseInt(form.cuttingPrice) || 0) : 0
    await supabase.from('quotes').update({
      status: 'quoted',
      quoted_quantity: parseFloat(form.quantity),
      quoted_unit: form.unit,
      unit_price: parseInt(form.unitPrice),
      cutting: form.cutting,
      cutting_price: cuttingPrice,
      total_amount: total,
      admin_note: form.adminNote || null,
      quoted_at: new Date().toISOString(),
    }).eq('id', quote.id)
    if (quote.user_email) {
      await fetch('/api/send-quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: quote.user_email, userName: quote.user_name || '고객',
          productType: PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type,
          quantity: form.quantity, unit: form.unit, unitPrice: form.unitPrice,
          cuttingPrice, totalAmount: total, adminNote: form.adminNote || '', quoteId: quote.id,
        }),
      })
    }
    await loadAll()
    setSending(null)
  }

  const updateOrderStatus = async (orderId: string, status: string, extraId?: string) => {
    setProcessing(extraId || orderId)
    await fetch('/api/admin/update-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status }),
    })
    await loadAll()
    setProcessing(null)
  }

  const saveTracking = async (orderId: string) => {
    setProcessing(orderId)
    await fetch('/api/admin/update-order-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, carrier: carrierInputs[orderId] || '', tracking_number: trackingInputs[orderId] || '' }),
    })
    await loadAll()
    setProcessing(null)
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('order-files').createSignedUrl(filePath, 60)
    if (!data?.signedUrl) return
    const res = await fetch(data.signedUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const parseFiles = (fileUrl: string | null, fileName: string | null) => {
    if (!fileUrl || !fileName) return []
    try {
      const urls = JSON.parse(fileUrl) as string[]
      const names = JSON.parse(fileName) as string[]
      return urls.map((url, i) => ({ url, name: names[i] || `파일 ${i + 1}` }))
    } catch { return [{ url: fileUrl, name: fileName }] }
  }

  // ── 필터링 ──
  const filtered = items.filter((item) => {
    const d = item.data
    const effectiveStatus = getEffectiveStatus(item)
    const createdAt = d.created_at

    if (tab !== 'all' && effectiveStatus !== tab) return false

    if (dateFrom && createdAt < dateFrom + 'T00:00:00') return false
    if (dateTo && createdAt > dateTo + 'T23:59:59') return false

    if (search) {
      const q = search.toLowerCase()
      const name = (d.user_name || '').toLowerCase()
      const email = (d.user_email || '').toLowerCase()
      const phone = (d.user_phone || '').toLowerCase()
      const orderName = ((d as any).order_name || '').toLowerCase()
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !orderName.includes(q)) return false
    }
    return true
  })

  const counts: Record<string, number> = {}
  items.forEach((item) => {
    const s = getEffectiveStatus(item)
    counts[s] = (counts[s] || 0) + 1
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
          <span className="text-sm text-gray-500">전체 {items.length}건</span>
        </div>

        {/* 검색 + 날짜 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 · 이메일 · 연락처 · 주문명 검색"
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* 상태 탭 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(({ key, label }) => {
            const cnt = key === 'all' ? items.length : (counts[key] || 0)
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  tab === key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {label}
                {cnt > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    tab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">해당하는 주문이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const key = item.type === 'quote' ? `q-${item.data.id}` : `o-${item.data.id}`
              const isExpanded = expanded === key
              const effectiveStatus = getEffectiveStatus(item)
              const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending
              const StatusIcon = cfg.icon
              const d = item.data

              return (
                <div key={key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* 헤더 */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : key)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-900">{d.user_name || d.user_email || '—'}</span>
                        {/* 주문 유형 배지 */}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.type === 'quote' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {item.type === 'quote' ? '견적주문' : '바로주문'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />{cfg.label}
                        </span>
                        {/* 견적 파일 다운로드 */}
                        {item.type === 'quote' && (() => {
                          const files = parseFiles((d as Quote).file_url, (d as Quote).file_name)
                          return files.map((f, i) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); downloadFile(f.url, f.name) }}
                              className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors">
                              <Download className="w-3 h-3" />시안{files.length > 1 ? ` ${i+1}` : ''}
                            </button>
                          ))
                        })()}
                      </div>
                      <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
                        {(d as any).order_name && <span className="font-semibold text-gray-600">📦 {(d as any).order_name}</span>}
                        {item.type === 'quote' && <span>{PRODUCT_TYPE_LABEL[(d as Quote).product_type] || (d as Quote).product_type}</span>}
                        <span>·</span>
                        <span>{new Date(d.created_at).toLocaleDateString('ko-KR')} {new Date(d.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {d.total_amount && <><span>·</span><span className="text-blue-600 font-bold">{d.total_amount.toLocaleString()}원</span></>}
                        {d.user_phone && <><span>·</span><span>{d.user_phone}</span></>}
                        {/* 송장 미리보기 */}
                        {item.type === 'quote' && (d as Quote).order?.tracking_number && (
                          <><span>·</span><span className="text-purple-600 font-semibold">{(d as Quote).order!.carrier} {(d as Quote).order!.tracking_number}</span></>
                        )}
                        {item.type === 'order' && (d as DirectOrder).tracking_number && (
                          <><span>·</span><span className="text-purple-600 font-semibold">{(d as DirectOrder).carrier} {(d as DirectOrder).tracking_number}</span></>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />}
                  </div>

                  {/* 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4 bg-white">

                      {/* 고객 정보 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 text-sm">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-3">고객 정보</p>
                          <div className="space-y-1.5">
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">이름</span><span className="text-gray-900 font-medium">{d.user_name || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">연락처</span><span className="text-gray-900">{d.user_phone || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">이메일</span><span className="text-gray-900 break-all">{d.user_email || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">주소</span><span className="text-gray-900">{d.user_address || '—'}</span></div>
                          </div>
                        </div>

                        {/* 바로주문: 상품 목록 / 견적주문: 요청 내용 */}
                        <div className="bg-gray-50 rounded-xl p-4 text-sm">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-3">
                            {item.type === 'order' ? '주문 상품' : '요청 내용'}
                          </p>
                          {item.type === 'order' ? (
                            <div className="space-y-2">
                              {(d as DirectOrder).order_items?.map((oi, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-gray-700">{oi.product_id} × {oi.quantity}{oi.cutting ? ' (컷팅)' : ''}</span>
                                  <span className="font-semibold text-gray-900">
                                    {((oi.unit_price * oi.quantity) + (oi.cutting ? oi.cutting_price : 0)).toLocaleString()}원
                                  </span>
                                </div>
                              ))}
                              {(d as DirectOrder).memo && (
                                <div className="text-xs text-gray-400 mt-2">{(d as DirectOrder).memo}</div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">상품</span><span className="text-gray-900">{PRODUCT_TYPE_LABEL[(d as Quote).product_type]}</span></div>
                              {(d as Quote).request_note && <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">요구사항</span><span className="text-gray-900">{(d as Quote).request_note}</span></div>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 견적주문 - 파일 다운로드 */}
                      {item.type === 'quote' && (() => {
                        const files = parseFiles((d as Quote).file_url, (d as Quote).file_name)
                        return files.length > 0 ? (
                          <div className="space-y-2">
                            {files.map((f, i) => (
                              <button key={i} onClick={() => downloadFile(f.url, f.name)}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
                                <Download className="w-4 h-4" />
                                시안 다운로드 {files.length > 1 ? `(${i+1}/${files.length})` : ''} — {f.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
                            첨부 파일 없음 — 요구사항 내용으로 확인하세요.
                          </div>
                        )
                      })()}

                      {/* ── 견적 작성 폼 (pending) ── */}
                      {item.type === 'quote' && (d as Quote).status === 'pending' && (() => {
                        const quote = d as Quote
                        const form = getForm(quote.id)
                        const total = calcTotal(form)
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
                            <p className="text-sm font-bold text-gray-900">견적 작성</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">출력 수량 *</label>
                                <div className="flex gap-2">
                                  <input type="text" inputMode="numeric" value={form.quantity}
                                    onChange={(e) => setForm(quote.id, { quantity: e.target.value })}
                                    placeholder="예) 3"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                  <select value={form.unit} onChange={(e) => setForm(quote.id, { unit: e.target.value })}
                                    className="border border-gray-300 rounded-lg px-2 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="M">M</option><option value="장">장</option><option value="개">개</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">단가 (원) *</label>
                                <input type="text" inputMode="numeric" value={form.unitPrice}
                                  onChange={(e) => setForm(quote.id, { unitPrice: e.target.value })}
                                  placeholder="예) 8900"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.cutting}
                                  onChange={(e) => setForm(quote.id, { cutting: e.target.checked })}
                                  className="w-4 h-4 accent-blue-600" />
                                <span className="text-sm font-medium text-gray-800">컷팅 포함</span>
                              </label>
                              {form.cutting && (
                                <input type="text" inputMode="numeric" value={form.cuttingPrice}
                                  onChange={(e) => setForm(quote.id, { cuttingPrice: e.target.value })}
                                  placeholder="컷팅 금액"
                                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              )}
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1.5">고객 메모 (선택)</label>
                              <input type="text" value={form.adminNote}
                                onChange={(e) => setForm(quote.id, { adminNote: e.target.value })}
                                placeholder="고객에게 전달할 내용"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>
                            {total > 0 && (
                              <div className="flex items-center justify-between bg-white border border-blue-300 rounded-xl px-4 py-3">
                                <span className="text-sm font-medium text-gray-700">견적 금액 (VAT 포함)</span>
                                <span className="font-bold text-blue-600 text-xl">{total.toLocaleString()}원</span>
                              </div>
                            )}
                            <div className="flex gap-3">
                              <button onClick={async () => {
                                if (!confirm('이 견적을 취소하시겠습니까?')) return
                                const supabase = createClient()
                                await supabase.from('quotes').update({ status: 'cancelled' }).eq('id', quote.id)
                                await loadAll()
                              }} className="flex-1 border-2 border-red-200 text-red-500 py-3 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
                                견적 거절
                              </button>
                              <button onClick={() => sendQuote(quote)}
                                disabled={sending === quote.id || !form.quantity || !form.unitPrice}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                <Send className="w-4 h-4" />
                                {sending === quote.id ? '발송 중...' : '견적 발송'}
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 견적 발송 내용 표시 */}
                      {item.type === 'quote' && ['quoted', 'paid'].includes((d as Quote).status) && (d as Quote).total_amount && (() => {
                        const quote = d as Quote
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-blue-700 uppercase">발송된 견적</p>
                              {quote.user_email && (
                                <button onClick={async () => {
                                  await fetch('/api/send-quote-email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userEmail: quote.user_email, userName: quote.user_name || '고객',
                                      productType: PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type,
                                      quantity: quote.quoted_quantity, unit: quote.quoted_unit,
                                      unitPrice: quote.unit_price, cuttingPrice: quote.cutting_price,
                                      totalAmount: quote.total_amount, adminNote: quote.admin_note || '', quoteId: quote.id }) })
                                  alert('이메일을 재발송했습니다.')
                                }} className="flex items-center gap-1.5 text-xs bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                                  <Send className="w-3 h-3" />이메일 재발송
                                </button>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {quote.quoted_quantity && <div className="flex gap-2"><span className="text-gray-600 w-20 shrink-0">출력 수량</span><span className="font-semibold text-gray-900">{quote.quoted_quantity}{quote.quoted_unit}</span></div>}
                              {quote.unit_price && <div className="flex gap-2"><span className="text-gray-600 w-20 shrink-0">단가</span><span className="text-gray-900">{quote.unit_price.toLocaleString()}원</span></div>}
                              {quote.cutting && <div className="flex gap-2"><span className="text-gray-600 w-20 shrink-0">컷팅</span><span className="text-gray-900">+{quote.cutting_price.toLocaleString()}원</span></div>}
                              <div className="flex gap-2 pt-2 border-t border-blue-200 mt-1">
                                <span className="text-gray-600 w-20 shrink-0">최종 금액</span>
                                <span className="font-bold text-blue-600 text-base">{quote.total_amount!.toLocaleString()}원</span>
                              </div>
                              {quote.admin_note && <div className="flex gap-2"><span className="text-gray-600 w-20 shrink-0">메모</span><span className="text-gray-900">{quote.admin_note}</span></div>}
                            </div>
                          </div>
                        )
                      })()}

                      {/* 무통장 입금 확인 (견적) */}
                      {item.type === 'quote' && (d as Quote).status === 'bank_transfer_pending' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
                          <p className="text-sm font-bold text-orange-800">무통장 입금 대기 — {(d as Quote).total_amount?.toLocaleString()}원</p>
                          <button onClick={async () => {
                            if (!confirm('입금 확인 후 결제완료 처리하시겠습니까?')) return
                            const res = await fetch('/api/admin/confirm-bank-transfer', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ quoteId: d.id, orderId: (d as Quote).order_id }),
                            })
                            if (!res.ok) { alert('오류가 발생했습니다.'); return }
                            await loadAll()
                          }} className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors">
                            입금 확인 완료 → 결제완료 처리
                          </button>
                        </div>
                      )}

                      {/* 무통장 입금 확인 (바로주문) */}
                      {item.type === 'order' && (d as DirectOrder).status === 'pending' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
                          <p className="text-sm font-bold text-orange-800">무통장 입금 대기 — {(d as DirectOrder).total_amount.toLocaleString()}원</p>
                          <button onClick={async () => {
                            if (!confirm('입금 확인 후 결제완료 처리하시겠습니까?')) return
                            await updateOrderStatus(d.id, 'paid')
                          }} disabled={processing === d.id}
                          className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50">
                            입금 확인 완료 → 결제완료 처리
                          </button>
                        </div>
                      )}

                      {/* 결제완료 이후 작업 상태 진행 */}
                      {(() => {
                        const orderId = item.type === 'quote' ? (d as Quote).order_id : d.id
                        const orderStatus = item.type === 'quote' ? (d as Quote).order?.status : (d as DirectOrder).status

                        if (!orderId || !orderStatus) return null
                        if (!['paid', 'in_progress', 'shipped', 'refund_requested'].includes(orderStatus)) return null

                        const NEXT: Record<string, string> = { paid: 'in_progress', in_progress: 'shipped', shipped: 'delivered' }
                        const NEXT_LABEL: Record<string, string> = { paid: '작업 시작', in_progress: '출고 처리', shipped: '배송 완료 처리' }

                        return (
                          <div className="space-y-3">
                            {/* 다음 단계 버튼 */}
                            {NEXT[orderStatus] && (
                              <button onClick={async () => {
                                if (confirm(`${NEXT_LABEL[orderStatus]}으로 변경하시겠습니까?`)) {
                                  await updateOrderStatus(orderId, NEXT[orderStatus], d.id)
                                }
                              }} disabled={processing === d.id}
                              className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                {NEXT_LABEL[orderStatus]} →
                              </button>
                            )}

                            {/* 송장 입력 (출고 이후) */}
                            {['in_progress', 'shipped'].includes(orderStatus) && (
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-gray-600">송장 정보</p>
                                <div className="flex gap-2">
                                  <select value={carrierInputs[orderId] ?? ((item.type === 'quote' ? (d as Quote).order?.carrier : (d as DirectOrder).carrier) || '')}
                                    onChange={(e) => setCarrierInputs((p) => ({ ...p, [orderId]: e.target.value }))}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="">택배사 선택</option>
                                    {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <input type="text"
                                    value={trackingInputs[orderId] ?? ((item.type === 'quote' ? (d as Quote).order?.tracking_number : (d as DirectOrder).tracking_number) || '')}
                                    onChange={(e) => setTrackingInputs((p) => ({ ...p, [orderId]: e.target.value }))}
                                    placeholder="송장번호"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                  <button onClick={() => saveTracking(orderId)} disabled={processing === d.id}
                                    className="shrink-0 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-50">
                                    저장
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 환불 요청 */}
                            {orderStatus === 'refund_requested' && (
                              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                                <p className="text-xs font-bold text-red-700">환불 요청</p>
                                {item.type === 'quote' && (d as Quote).order?.refund_reason && (
                                  <p className="text-sm text-gray-700">사유: {(d as Quote).order!.refund_reason}</p>
                                )}
                                {item.type === 'order' && (d as DirectOrder).refund_reason && (
                                  <p className="text-sm text-gray-700">사유: {(d as DirectOrder).refund_reason}</p>
                                )}
                                <div className="flex gap-2">
                                  <button onClick={async () => {
                                    if (confirm('환불을 승인하시겠습니까?\n※ 토스페이먼츠 대시보드에서 실제 환불을 진행해주세요.')) {
                                      await updateOrderStatus(orderId, 'refunded', d.id)
                                    }
                                  }} disabled={processing === d.id}
                                  className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                                    환불 승인
                                  </button>
                                  <button onClick={async () => {
                                    if (confirm('환불 요청을 거절하시겠습니까?')) {
                                      await updateOrderStatus(orderId, 'paid', d.id)
                                    }
                                  }} disabled={processing === d.id}
                                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                                    거절
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 취소 */}
                            {orderStatus === 'paid' && (
                              <button onClick={async () => {
                                if (confirm('주문을 취소하시겠습니까?')) {
                                  await updateOrderStatus(orderId, 'cancelled', d.id)
                                }
                              }} disabled={processing === d.id}
                              className="w-full border border-red-300 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                                주문 취소
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* 배송완료 */}
                      {(() => {
                        const orderStatus = item.type === 'quote' ? (d as Quote).order?.status : (d as DirectOrder).status
                        return orderStatus === 'delivered' ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center text-sm text-green-700 font-bold">
                            ✓ 배송 완료
                          </div>
                        ) : orderStatus === 'refunded' ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-sm text-gray-500">
                            환불 완료된 주문입니다.
                          </div>
                        ) : (d as Quote).status === 'cancelled' || (d as DirectOrder).status === 'cancelled' ? (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center text-sm text-red-500">
                            취소된 주문입니다.
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
