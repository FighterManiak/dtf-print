'use client'

import { useState, useEffect } from 'react'
import { Download, CheckCircle, Clock, CreditCard, XCircle, ChevronDown, ChevronUp, Send, Truck, Package, RotateCcw, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  A4: 'A4 출력', A3: 'A3 출력', roll_58: '58cm 롤 출력', other: '기타',
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:               { label: '검토 대기',   dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 ring-amber-200',   icon: Clock },
  quoted:                { label: '견적 발송',   dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 ring-blue-200',   icon: Send },
  bank_transfer_pending: { label: '입금 확인중', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 ring-orange-200', icon: Clock },
  order_pending:         { label: '입금 대기',   dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 ring-orange-200', icon: Clock },
  paid:                  { label: '결제 완료',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CreditCard },
  in_progress:           { label: '작업 중',     dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 ring-violet-200', icon: Package },
  shipped:               { label: '출고 완료',   dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', icon: Truck },
  delivered:             { label: '배송 완료',   dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 ring-green-200',  icon: CheckCircle },
  refund_requested:      { label: '환불 요청',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 ring-red-200',    icon: RotateCcw },
  refunded:              { label: '환불 완료',   dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 ring-gray-200',   icon: RotateCcw },
  cancelled:             { label: '취소',        dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 ring-gray-200',   icon: XCircle },
}

const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배', '쿠팡로켓', '기타']

const TABS = [
  { key: 'all',                  label: '전체' },
  { key: 'pending',              label: '검토 대기' },
  { key: 'quoted',               label: '견적 발송' },
  { key: 'bank_transfer_pending',label: '입금 확인' },
  { key: 'order_pending',        label: '바로주문 입금' },
  { key: 'paid',                 label: '결제 완료' },
  { key: 'in_progress',          label: '작업 중' },
  { key: 'shipped',              label: '출고' },
  { key: 'delivered',            label: '배송 완료' },
  { key: 'refund_requested',     label: '환불 요청' },
  { key: 'cancelled',            label: '취소' },
] as const

interface OrderInfo {
  id: string; status: string; carrier: string | null
  tracking_number: string | null; refund_reason: string | null
}
interface Quote {
  id: string; created_at: string; status: string
  user_name: string | null; user_email: string | null; user_phone: string | null; user_address: string | null
  product_type: string; order_name: string | null; request_note: string | null
  file_url: string | null; file_name: string | null
  quoted_quantity: number | null; quoted_unit: string | null
  cutting: boolean; cutting_price: number; unit_price: number | null; total_amount: number | null
  admin_note: string | null; order_id: string | null; order?: OrderInfo | null
}
interface DirectOrder {
  id: string; created_at: string; status: string
  user_name: string | null; user_email: string | null; user_phone: string | null; user_address: string | null
  order_name: string | null; total_amount: number; carrier: string | null; tracking_number: string | null
  memo: string | null; refund_reason: string | null
  order_items: { id: string; product_id: string; quantity: number; unit_price: number; cutting: boolean; cutting_price: number; request_note: string | null }[]
}
type Item = { type: 'quote'; data: Quote } | { type: 'order'; data: DirectOrder }
interface QuoteForm { quantity: string; unit: string; unitPrice: string; cutting: boolean; cuttingPrice: string; adminNote: string }

function getEffectiveStatus(item: Item): string {
  if (item.type === 'quote') {
    const q = item.data
    if (q.order) return q.order.status
    return q.status
  }
  return item.data.status === 'pending' ? 'order_pending' : item.data.status
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
    const { data: quotesData } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
    const orderIds = (quotesData || []).map((q) => q.order_id).filter(Boolean) as string[]
    let ordersMap: Record<string, OrderInfo> = {}
    if (orderIds.length > 0) {
      const { data: linked } = await supabase.from('orders').select('id,status,carrier,tracking_number,refund_reason').in('id', orderIds)
      if (linked) linked.forEach((o) => { ordersMap[o.id] = o })
    }
    const quoteItems: Item[] = (quotesData || []).map((q) => ({ type: 'quote' as const, data: { ...q, order: q.order_id ? (ordersMap[q.order_id] ?? null) : null } }))
    const linkedSet = new Set(orderIds)
    const { data: directData } = await supabase.from('orders').select('*,order_items(*)').order('created_at', { ascending: false })
    const directItems: Item[] = (directData || []).filter((o) => !linkedSet.has(o.id)).map((o) => ({ type: 'order' as const, data: o }))
    const merged = [...quoteItems, ...directItems].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
    setItems(merged)
    setLoading(false)
  }

  const getForm = (id: string): QuoteForm => forms[id] || { quantity: '', unit: 'M', unitPrice: '', cutting: false, cuttingPrice: '', adminNote: '' }
  const setForm = (id: string, patch: Partial<QuoteForm>) => setForms((p) => ({ ...p, [id]: { ...getForm(id), ...patch } }))
  const calcTotal = (form: QuoteForm) => (parseFloat(form.quantity) || 0) * (parseInt(form.unitPrice) || 0) + (form.cutting ? (parseInt(form.cuttingPrice) || 0) : 0)

  const sendQuote = async (quote: Quote) => {
    const form = getForm(quote.id)
    if (!form.quantity || !form.unitPrice) { alert('수량과 단가를 입력하세요.'); return }
    setSending(quote.id)
    const supabase = createClient()
    const total = calcTotal(form)
    const cuttingPrice = form.cutting ? (parseInt(form.cuttingPrice) || 0) : 0
    await supabase.from('quotes').update({ status: 'quoted', quoted_quantity: parseFloat(form.quantity), quoted_unit: form.unit, unit_price: parseInt(form.unitPrice), cutting: form.cutting, cutting_price: cuttingPrice, total_amount: total, admin_note: form.adminNote || null, quoted_at: new Date().toISOString() }).eq('id', quote.id)
    if (quote.user_email) {
      await fetch('/api/send-quote-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userEmail: quote.user_email, userName: quote.user_name || '고객', productType: PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type, quantity: form.quantity, unit: form.unit, unitPrice: form.unitPrice, cuttingPrice, totalAmount: total, adminNote: form.adminNote || '', quoteId: quote.id }) })
    }
    await loadAll(); setSending(null)
  }

  const updateOrderStatus = async (orderId: string, status: string, itemKey?: string) => {
    setProcessing(itemKey || orderId)
    await fetch('/api/admin/update-order-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, status }) })
    await loadAll(); setProcessing(null)
  }

  const saveTracking = async (orderId: string) => {
    setProcessing(orderId)
    await fetch('/api/admin/update-order-tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, carrier: carrierInputs[orderId] || '', tracking_number: trackingInputs[orderId] || '' }) })
    await loadAll(); setProcessing(null)
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('order-files').createSignedUrl(filePath, 60)
    if (!data?.signedUrl) return
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const parseFiles = (fileUrl: string | null, fileName: string | null) => {
    if (!fileUrl || !fileName) return []
    try { return (JSON.parse(fileUrl) as string[]).map((url, i) => ({ url, name: (JSON.parse(fileName) as string[])[i] || `파일 ${i+1}` })) }
    catch { return [{ url: fileUrl, name: fileName }] }
  }

  const filtered = items.filter((item) => {
    const s = getEffectiveStatus(item)
    if (tab !== 'all' && s !== tab) return false
    if (dateFrom && item.data.created_at < dateFrom + 'T00:00:00') return false
    if (dateTo && item.data.created_at > dateTo + 'T23:59:59') return false
    if (search) {
      const q = search.toLowerCase()
      const d = item.data
      if (![(d.user_name || ''), (d.user_email || ''), (d.user_phone || ''), ((d as any).order_name || '')].some((v) => v.toLowerCase().includes(q))) return false
    }
    return true
  })

  const counts: Record<string, number> = {}
  items.forEach((item) => { const s = getEffectiveStatus(item); counts[s] = (counts[s] || 0) + 1 })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 {items.length}건</p>
          </div>
        </div>

        {/* 검색 + 날짜 필터 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-center shadow-sm">
          <div className="flex items-center gap-2 flex-1 min-w-52 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 · 연락처 · 이메일 · 주문명" className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-400" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <span className="text-gray-400 text-sm font-medium">~</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>

        {/* 상태 탭 */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {TABS.map(({ key, label }) => {
            const cnt = key === 'all' ? items.length : (counts[key] || 0)
            const isActive = tab === key
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  isActive ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                {label}
                {cnt > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="text-center py-24 text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">해당하는 주문이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const itemKey = item.type === 'quote' ? `q-${item.data.id}` : `o-${item.data.id}`
              const isExpanded = expanded === itemKey
              const effectiveStatus = getEffectiveStatus(item)
              const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending
              const StatusIcon = cfg.icon
              const d = item.data

              return (
                <div key={itemKey} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* 카드 헤더 */}
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(isExpanded ? null : itemKey)}>
                    {/* 상태 도트 */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{d.user_name || d.user_email || '—'}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${item.type === 'quote' ? 'bg-blue-50 text-blue-600 ring-blue-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                          {item.type === 'quote' ? '견적' : '바로주문'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ${cfg.badge}`}>
                          <StatusIcon className="w-3 h-3" />{cfg.label}
                        </span>
                        {/* 파일 다운 버튼 */}
                        {item.type === 'quote' && (() => {
                          const files = parseFiles((d as Quote).file_url, (d as Quote).file_name)
                          return files.map((f, i) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); downloadFile(f.url, f.name) }}
                              className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors font-semibold">
                              <Download className="w-3 h-3" />시안{files.length > 1 ? ` ${i+1}` : ''}
                            </button>
                          ))
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(d as any).order_name && <span className="text-sm font-semibold text-gray-800">{(d as any).order_name}</span>}
                        {item.type === 'quote' && <span className="text-xs text-gray-400">{PRODUCT_TYPE_LABEL[(d as Quote).product_type]}</span>}
                        <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('ko-KR')} {new Date(d.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {d.total_amount && <span className="text-xs font-bold text-blue-600">{d.total_amount.toLocaleString()}원</span>}
                        {d.user_phone && <span className="text-xs text-gray-400">{d.user_phone}</span>}
                        {/* 송장 미리보기 */}
                        {(() => {
                          const carrier = item.type === 'quote' ? (d as Quote).order?.carrier : (d as DirectOrder).carrier
                          const tracking = item.type === 'quote' ? (d as Quote).order?.tracking_number : (d as DirectOrder).tracking_number
                          return tracking ? <span className="text-xs font-semibold text-indigo-600">{carrier} {tracking}</span> : null
                        })()}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </div>

                  {/* 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4">

                      {/* 고객 정보 + 요청 내용 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-gray-200 p-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">고객 정보</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">이름</span><span className="text-gray-900 font-medium">{d.user_name || '—'}</span></div>
                            <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">연락처</span><span className="text-gray-900">{d.user_phone || '—'}</span></div>
                            <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">이메일</span><span className="text-gray-900 break-all">{d.user_email || '—'}</span></div>
                            <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">주소</span><span className="text-gray-900">{d.user_address || '—'}</span></div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{item.type === 'order' ? '주문 상품' : '요청 내용'}</p>
                          {item.type === 'order' ? (
                            <div className="space-y-2 text-sm">
                              {(d as DirectOrder).order_items?.map((oi, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-gray-700">{oi.product_id} × {oi.quantity}{oi.cutting ? ' + 컷팅' : ''}</span>
                                  <span className="font-bold text-gray-900">{((oi.unit_price * oi.quantity) + (oi.cutting ? oi.cutting_price : 0)).toLocaleString()}원</span>
                                </div>
                              ))}
                              {(d as DirectOrder).memo && <p className="text-xs text-gray-400 pt-1">{(d as DirectOrder).memo}</p>}
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">상품</span><span className="text-gray-900 font-medium">{PRODUCT_TYPE_LABEL[(d as Quote).product_type]}</span></div>
                              {(d as Quote).request_note && <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">요구사항</span><span className="text-gray-900">{(d as Quote).request_note}</span></div>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 파일 다운로드 */}
                      {item.type === 'quote' && (() => {
                        const files = parseFiles((d as Quote).file_url, (d as Quote).file_name)
                        return files.length > 0 ? (
                          <div className="space-y-2">
                            {files.map((f, i) => (
                              <button key={i} onClick={() => downloadFile(f.url, f.name)}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                                <Download className="w-4 h-4" />
                                시안 다운로드{files.length > 1 ? ` (${i+1}/${files.length})` : ''} — {f.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            첨부 파일 없음 — 요구사항 내용으로 확인하세요.
                          </div>
                        )
                      })()}

                      {/* ── 견적 작성 폼 ── */}
                      {item.type === 'quote' && (d as Quote).status === 'pending' && (() => {
                        const quote = d as Quote
                        const form = getForm(quote.id)
                        const total = calcTotal(form)
                        return (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4">
                            <p className="text-sm font-bold text-gray-900">견적 작성</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">출력 수량 *</label>
                                <div className="flex gap-2">
                                  <input type="text" inputMode="numeric" value={form.quantity} onChange={(e) => setForm(quote.id, { quantity: e.target.value })} placeholder="예) 3"
                                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                  <select value={form.unit} onChange={(e) => setForm(quote.id, { unit: e.target.value })}
                                    className="border border-gray-300 rounded-xl px-2 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="M">M</option><option value="장">장</option><option value="개">개</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">단가 (원) *</label>
                                <input type="text" inputMode="numeric" value={form.unitPrice} onChange={(e) => setForm(quote.id, { unitPrice: e.target.value })} placeholder="예) 8900"
                                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.cutting} onChange={(e) => setForm(quote.id, { cutting: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                                <span className="text-sm font-medium text-gray-800">컷팅 포함</span>
                              </label>
                              {form.cutting && (
                                <input type="text" inputMode="numeric" value={form.cuttingPrice} onChange={(e) => setForm(quote.id, { cuttingPrice: e.target.value })} placeholder="컷팅 금액"
                                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              )}
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1.5">고객 메모 (선택)</label>
                              <input type="text" value={form.adminNote} onChange={(e) => setForm(quote.id, { adminNote: e.target.value })} placeholder="고객에게 전달할 내용"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>
                            {total > 0 && (
                              <div className="flex items-center justify-between bg-white border border-blue-200 rounded-xl px-4 py-3">
                                <span className="text-sm text-gray-600">견적 금액 (VAT 포함)</span>
                                <span className="font-bold text-blue-600 text-xl">{total.toLocaleString()}원</span>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={async () => { if (!confirm('견적을 거절하시겠습니까?')) return; const supabase = createClient(); await supabase.from('quotes').update({ status: 'cancelled' }).eq('id', quote.id); await loadAll() }}
                                className="flex-1 border-2 border-red-200 text-red-500 py-3 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
                                견적 거절
                              </button>
                              <button onClick={() => sendQuote(quote)} disabled={sending === quote.id || !form.quantity || !form.unitPrice}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                <Send className="w-4 h-4" />
                                {sending === quote.id ? '발송 중...' : '견적 발송'}
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 발송된 견적 내용 */}
                      {item.type === 'quote' && ['quoted', 'paid'].includes((d as Quote).status) && (d as Quote).total_amount && (() => {
                        const quote = d as Quote
                        return (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">발송된 견적</p>
                              {quote.user_email && (
                                <button onClick={async () => {
                                  await fetch('/api/send-quote-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userEmail: quote.user_email, userName: quote.user_name || '고객', productType: PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type, quantity: quote.quoted_quantity, unit: quote.quoted_unit, unitPrice: quote.unit_price, cuttingPrice: quote.cutting_price, totalAmount: quote.total_amount, adminNote: quote.admin_note || '', quoteId: quote.id }) })
                                  alert('이메일을 재발송했습니다.')
                                }} className="flex items-center gap-1 text-xs bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-semibold">
                                  <Send className="w-3 h-3" />이메일 재발송
                                </button>
                              )}
                            </div>
                            <div className="space-y-1.5 text-sm">
                              {quote.quoted_quantity && <div className="flex gap-3"><span className="w-16 text-gray-500">출력 수량</span><span className="font-semibold text-gray-900">{quote.quoted_quantity}{quote.quoted_unit}</span></div>}
                              {quote.unit_price && <div className="flex gap-3"><span className="w-16 text-gray-500">단가</span><span className="text-gray-900">{quote.unit_price.toLocaleString()}원</span></div>}
                              {quote.cutting && <div className="flex gap-3"><span className="w-16 text-gray-500">컷팅</span><span className="text-gray-900">+{quote.cutting_price.toLocaleString()}원</span></div>}
                              <div className="flex gap-3 pt-2 border-t border-blue-200">
                                <span className="w-16 text-gray-500">최종 금액</span>
                                <span className="font-bold text-blue-700 text-base">{quote.total_amount!.toLocaleString()}원</span>
                              </div>
                              {quote.admin_note && <div className="flex gap-3"><span className="w-16 text-gray-500">메모</span><span className="text-gray-900">{quote.admin_note}</span></div>}
                            </div>
                          </div>
                        )
                      })()}

                      {/* 무통장 입금 확인 (견적) */}
                      {item.type === 'quote' && (d as Quote).status === 'bank_transfer_pending' && (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-orange-800">무통장 입금 대기</p>
                            <span className="text-sm font-bold text-orange-700">{(d as Quote).total_amount?.toLocaleString()}원</span>
                          </div>
                          <button onClick={async () => {
                            if (!confirm('입금 확인 후 결제완료 처리하시겠습니까?')) return
                            const res = await fetch('/api/admin/confirm-bank-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: d.id, orderId: (d as Quote).order_id }) })
                            if (!res.ok) { alert('오류가 발생했습니다.'); return }
                            await loadAll()
                          }} className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors">
                            입금 확인 완료 → 결제완료 처리
                          </button>
                        </div>
                      )}

                      {/* 무통장 입금 확인 (바로주문) */}
                      {item.type === 'order' && (d as DirectOrder).status === 'pending' && (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-orange-800">무통장 입금 대기</p>
                            <span className="text-sm font-bold text-orange-700">{(d as DirectOrder).total_amount.toLocaleString()}원</span>
                          </div>
                          <button onClick={async () => { if (!confirm('입금 확인 후 결제완료 처리하시겠습니까?')) return; await updateOrderStatus(d.id, 'paid') }}
                            disabled={processing === d.id}
                            className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50">
                            입금 확인 완료 → 결제완료 처리
                          </button>
                        </div>
                      )}

                      {/* 결제 후 작업 진행 */}
                      {(() => {
                        const orderId = item.type === 'quote' ? (d as Quote).order_id : d.id
                        const orderStatus = item.type === 'quote' ? (d as Quote).order?.status : (d as DirectOrder).status
                        if (!orderId || !orderStatus) return null
                        if (!['paid', 'in_progress', 'shipped', 'refund_requested'].includes(orderStatus)) return null

                        const NEXT: Record<string, string> = { paid: 'in_progress', in_progress: 'shipped', shipped: 'delivered' }
                        const NEXT_LABEL: Record<string, string> = { paid: '작업 시작', in_progress: '출고 처리', shipped: '배송 완료 처리' }
                        const NEXT_COLOR: Record<string, string> = { paid: 'bg-violet-600 hover:bg-violet-700', in_progress: 'bg-indigo-600 hover:bg-indigo-700', shipped: 'bg-green-600 hover:bg-green-700' }

                        return (
                          <div className="space-y-3">
                            {NEXT[orderStatus] && (
                              <button onClick={async () => { if (confirm(`'${NEXT_LABEL[orderStatus]}'으로 변경하시겠습니까?`)) await updateOrderStatus(orderId, NEXT[orderStatus], itemKey) }}
                                disabled={processing === itemKey}
                                className={`w-full text-white py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${NEXT_COLOR[orderStatus] || 'bg-gray-700 hover:bg-gray-800'}`}>
                                {NEXT_LABEL[orderStatus]} →
                              </button>
                            )}

                            {/* 송장 입력 */}
                            {['in_progress', 'shipped'].includes(orderStatus) && (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">송장 정보</p>
                                <div className="flex gap-2">
                                  <select value={carrierInputs[orderId] ?? ((item.type === 'quote' ? (d as Quote).order?.carrier : (d as DirectOrder).carrier) || '')}
                                    onChange={(e) => setCarrierInputs((p) => ({ ...p, [orderId]: e.target.value }))}
                                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="">택배사 선택</option>
                                    {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <input type="text"
                                    value={trackingInputs[orderId] ?? ((item.type === 'quote' ? (d as Quote).order?.tracking_number : (d as DirectOrder).tracking_number) || '')}
                                    onChange={(e) => setTrackingInputs((p) => ({ ...p, [orderId]: e.target.value }))}
                                    placeholder="송장번호"
                                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                  <button onClick={() => saveTracking(orderId)} disabled={processing === itemKey}
                                    className="shrink-0 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-50">
                                    저장
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 환불 요청 처리 */}
                            {orderStatus === 'refund_requested' && (
                              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
                                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">환불 요청</p>
                                {(() => {
                                  const reason = item.type === 'quote' ? (d as Quote).order?.refund_reason : (d as DirectOrder).refund_reason
                                  return reason ? <p className="text-sm text-gray-700 bg-white border border-red-100 rounded-lg px-3 py-2">{reason}</p> : null
                                })()}
                                <div className="flex gap-2">
                                  <button onClick={async () => { if (confirm('환불을 승인하시겠습니까?\n※ 토스페이먼츠 대시보드에서 실제 환불을 진행해주세요.')) await updateOrderStatus(orderId, 'refunded', itemKey) }}
                                    disabled={processing === itemKey}
                                    className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                                    환불 승인
                                  </button>
                                  <button onClick={async () => { if (confirm('환불 요청을 거절하시겠습니까?')) await updateOrderStatus(orderId, 'paid', itemKey) }}
                                    disabled={processing === itemKey}
                                    className="flex-1 border border-gray-300 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                                    거절
                                  </button>
                                </div>
                              </div>
                            )}

                            {orderStatus === 'paid' && (
                              <button onClick={async () => { if (confirm('주문을 취소하시겠습니까?')) await updateOrderStatus(orderId, 'cancelled', itemKey) }}
                                disabled={processing === itemKey}
                                className="w-full border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                                주문 취소
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* 완료 상태 표시 */}
                      {(() => {
                        const orderStatus = item.type === 'quote' ? (d as Quote).order?.status : (d as DirectOrder).status
                        const quoteStatus = item.type === 'quote' ? (d as Quote).status : null
                        if (orderStatus === 'delivered') return <div className="rounded-xl bg-green-50 border border-green-200 py-3 text-center text-sm font-bold text-green-700">✓ 배송 완료</div>
                        if (orderStatus === 'refunded') return <div className="rounded-xl bg-gray-100 border border-gray-200 py-3 text-center text-sm text-gray-500">환불 완료된 주문입니다.</div>
                        if (orderStatus === 'cancelled' || quoteStatus === 'cancelled') return <div className="rounded-xl bg-red-50 border border-red-200 py-3 text-center text-sm text-red-500">취소된 주문입니다.</div>
                        return null
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
