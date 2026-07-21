'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ChevronDown, ChevronUp, Clock, CheckCircle, CreditCard, XCircle, Download, Building2, Truck, Package, RotateCcw, Star, X, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_jZ61JOxRQVEoxknP6KD8W0X9bAqw'

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  A4: 'A4 출력',
  A3: 'A3 출력',
  roll_58: '58cm 롤 출력',
  other: '기타',
  direct: '바로주문',
}

const BANK_INFO = {
  bank: '기업은행',
  account: '495-028223-01-021',
  holder: '아유디스터디 (조봉준)',
}

// 통합 상태 설정 (견적 + 주문 단계 모두)
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:               { label: '검토 대기중',  color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  quoted:                { label: '견적 완료',    color: 'bg-blue-100 text-blue-700',     icon: CheckCircle },
  bank_transfer_pending: { label: '입금 확인중',  color: 'bg-orange-100 text-orange-700', icon: Clock },
  paid:                  { label: '결제 완료',    color: 'bg-green-100 text-green-700',   icon: CreditCard },
  in_progress:           { label: '작업 중',      color: 'bg-yellow-100 text-yellow-700', icon: Package },
  shipped:               { label: '출고 완료',    color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered:             { label: '배송 완료',    color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  refund_requested:      { label: '환불 요청',    color: 'bg-orange-100 text-orange-700', icon: RotateCcw },
  refunded:              { label: '환불 완료',    color: 'bg-gray-100 text-gray-500',     icon: RotateCcw },
  cancelled:             { label: '취소',         color: 'bg-red-100 text-red-600',       icon: XCircle },
}

interface Order {
  id: string
  status: string
  carrier: string | null
  tracking_number: string | null
  refund_reason: string | null
  assigned_machine: number | null
}

interface Quote {
  id: string
  created_at: string
  status: string
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
  quoted_at: string | null
  order_id: string | null
  user_id: string | null
  user_email: string | null
  user_name: string | null
  user_phone: string | null
  user_address: string | null
  order?: Order | null
}

interface ReorderModal {
  quote: Quote
  quantity: string
}

// 통합 상태: 주문이 있으면 주문 상태를, 없으면 견적 상태를 사용
function getDisplayStatus(quote: Quote): string {
  if (quote.order) return quote.order.status
  return quote.status
}

type QuickRange = '전체' | '오늘' | '어제' | '최근 3일' | '최근 7일' | '최근 1달'

const fmt = (d: Date) => d.toISOString().slice(0, 10)

function getRangeDates(range: QuickRange): { from: string; to: string } {
  const now = new Date()
  const today = fmt(now)
  if (range === '전체') return { from: '2000-01-01', to: today }
  if (range === '오늘') return { from: today, to: today }
  if (range === '어제') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    return { from: fmt(y), to: fmt(y) }
  }
  if (range === '최근 3일') {
    const d = new Date(now); d.setDate(d.getDate() - 2)
    return { from: fmt(d), to: today }
  }
  if (range === '최근 7일') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: fmt(d), to: today }
  }
  const d = new Date(now); d.setMonth(d.getMonth() - 1)
  return { from: fmt(d), to: today }
}

export default function MyOrdersPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<Record<string, 'card' | 'bank'>>({})
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [reorderModal, setReorderModal] = useState<ReorderModal | null>(null)
  const [reordering, setReordering] = useState(false)
  const [quickRange, setQuickRange] = useState<QuickRange>('전체')
  const [dateFrom, setDateFrom] = useState(() => getRangeDates('전체').from)
  const [dateTo, setDateTo] = useState(() => getRangeDates('전체').to)
  const userIdRef = React.useRef<string>('')

  // 리뷰
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([])
  const [reviewedQuoteIds, setReviewedQuoteIds] = useState<string[]>([])
  const [reviewModal, setReviewModal] = useState<{ orderId: string | null; quoteId: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const loadReviewed = () => fetch('/api/reviews/mine').then((r) => r.ok ? r.json() : null).then((d) => {
    if (d?.reviewedOrderIds) setReviewedOrderIds(d.reviewedOrderIds)
    if (d?.reviewedQuoteIds) setReviewedQuoteIds(d.reviewedQuoteIds)
  }).catch(() => {})

  const openReview = (orderId: string | null, quoteId: string) => {
    setReviewModal({ orderId, quoteId }); setReviewRating(5); setReviewText(''); setReviewFiles([])
  }

  const submitReview = async () => {
    if (!reviewModal || !user) return
    setReviewSubmitting(true)
    const supabase = createClient()
    const imagePaths: string[] = []
    for (const file of reviewFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `reviews/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('order-files').upload(path, file)
      if (!error) imagePaths.push(path)
    }
    const res = await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: reviewModal.orderId, quoteId: reviewModal.quoteId, rating: reviewRating, content: reviewText, imagePaths }),
    })
    if (res.ok) { setReviewModal(null); await loadReviewed() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '리뷰 등록 실패') }
    setReviewSubmitting(false)
  }

  const QUICK_RANGES: QuickRange[] = ['전체', '오늘', '어제', '최근 3일', '최근 7일', '최근 1달']

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser({ id: user.id, email: user.email || '' })
      userIdRef.current = user.id
      loadReviewed()
      await loadData(user.id, dateFrom, dateTo)
    }
    init()
  }, [])

  // 목록/페이지크기가 바뀌면 1페이지로
  useEffect(() => { setPage(1) }, [quotes.length, dateFrom, dateTo, pageSize])

  const totalPages = Math.max(1, Math.ceil(quotes.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedQuotes = quotes.slice((safePage - 1) * pageSize, safePage * pageSize)

  const applyQuickRange = (range: QuickRange) => {
    const { from, to } = getRangeDates(range)
    setQuickRange(range)
    setDateFrom(from)
    setDateTo(to)
    if (userIdRef.current) loadData(userIdRef.current, from, to)
  }

  const applyCustomRange = () => {
    setQuickRange('' as QuickRange)
    if (userIdRef.current) loadData(userIdRef.current, dateFrom, dateTo)
  }

  const loadData = async (uid: string, from: string, to: string) => {
    setLoading(true)

    // 견적 목록 조회 (RLS 우회 위해 서비스롤 API 사용, 날짜 필터 적용)
    const quotesData: Quote[] = await fetch(`/api/my-quotes?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : [])
      .catch(() => [])

    if (!quotesData) { setLoading(false); return }

    // 내 주문(orders) 서비스롤 조회 — 견적 연결정보 + 바로주문 pseudo-quote 모두에 사용
    const allOrders: Array<Record<string, unknown>> = await fetch('/api/my-orders').then((r) => r.ok ? r.json() : []).catch(() => [])

    // order_id 가 있는 견적의 주문 정보 매핑
    const orderIds = quotesData.map((q) => q.order_id).filter(Boolean) as string[]
    const ordersMap: Record<string, Order> = {}
    allOrders.forEach((o) => {
      const id = o.id as string
      ordersMap[id] = {
        id, status: o.status as string,
        carrier: (o.carrier as string) || null,
        tracking_number: (o.tracking_number as string) || null,
        refund_reason: (o.refund_reason as string) || null,
        assigned_machine: (o.assigned_machine as number) ?? null,
      }
    })

    const merged = quotesData.map((q) => ({
      ...q,
      order: q.order_id ? (ordersMap[q.order_id] ?? null) : null,
    }))

    // 바로주문(orders) → 견적에 연결되지 않은 주문을 pseudo-quote로 변환
    const linkedOrderIds = new Set(orderIds)
    let directQuotes: Quote[] = []
    try {
      directQuotes = allOrders
        .filter((o) => !linkedOrderIds.has(o.id as string))
        .filter((o) => {
          const c = (o.created_at as string) || ''
          return c >= from + 'T00:00:00' && c <= to + 'T23:59:59'
        })
        .map((o) => ({
          id: o.id as string,
          created_at: o.created_at as string,
          status: o.status as string,
          product_type: 'direct',
          order_name: (o.order_name as string) || null,
          request_note: (o.memo as string) || null,
          file_url: null, file_name: null,
          quoted_quantity: null, quoted_unit: null,
          cutting: false, cutting_price: 0,
          unit_price: null, total_amount: (o.total_amount as number) ?? null,
          admin_note: null, quoted_at: null,
          order_id: o.id as string,
          user_id: (o.user_id as string) || null,
          user_email: (o.user_email as string) || null,
          user_name: (o.user_name as string) || null,
          user_phone: (o.user_phone as string) || null,
          user_address: (o.user_address as string) || null,
          order: {
            id: o.id as string,
            status: o.status as string,
            carrier: (o.carrier as string) || null,
            tracking_number: (o.tracking_number as string) || null,
            refund_reason: (o.refund_reason as string) || null,
            assigned_machine: (o.assigned_machine as number) ?? null,
          },
        }))
    } catch { /* 바로주문 조회 실패 시 견적만 표시 */ }

    const all = [...merged, ...directQuotes].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setQuotes(all)
    setLoading(false)
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('order-files').createSignedUrl(filePath, 60)
    if (!data?.signedUrl) return
    const res = await fetch(data.signedUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fileName
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const parseFiles = (fileUrl: string | null, fileName: string | null) => {
    if (!fileUrl || !fileName) return []
    try {
      const urls = JSON.parse(fileUrl) as string[]
      const names = JSON.parse(fileName) as string[]
      return urls.map((url, i) => ({ url, name: names[i] || `파일 ${i + 1}` }))
    } catch {
      return [{ url: fileUrl, name: fileName }]
    }
  }

  const handlePay = async (quote: Quote) => {
    if (!quote.total_amount || !user) return
    setPaying(quote.id)
    try {
      const toss = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = toss.payment({ customerKey: user.id })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: quote.total_amount },
        orderId: `QUOTE-${quote.id.slice(0, 8)}-${Date.now()}`,
        orderName: `${PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type} 견적`,
        successUrl: `${window.location.origin}/quote/success?quoteId=${quote.id}`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch {
      setPaying(null)
    }
  }

  const handleBankTransfer = async (quote: Quote) => {
    if (!quote.total_amount || !user) return
    if (!confirm(`무통장 입금으로 결제하시겠습니까?\n\n은행: ${BANK_INFO.bank}\n계좌번호: ${BANK_INFO.account}\n예금주: ${BANK_INFO.holder}\n금액: ${quote.total_amount.toLocaleString()}원\n\n입금 후 관리자가 확인 후 처리됩니다.`)) return
    setPaying(quote.id)
    const res = await fetch('/api/quote/bank-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quote.id }),
    })
    if (res.ok) {
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, status: 'bank_transfer_pending', order: null } : q))
    } else {
      alert('처리 중 오류가 발생했습니다.')
    }
    setPaying(null)
  }

  const handleReorder = async () => {
    if (!reorderModal || !user) return
    const qty = reorderModal.quantity.trim()
    if (!qty) { alert('수량을 입력해주세요.'); return }
    setReordering(true)
    const { quote } = reorderModal
    const res = await fetch('/api/quote/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: quote.user_name, userEmail: quote.user_email,
        userPhone: quote.user_phone, userAddress: quote.user_address,
        productType: quote.product_type, orderName: quote.order_name,
        requestNote: `재구매 (수량: ${qty})\n${quote.request_note || ''}`.trim(),
        fileUrls: quote.file_url ? JSON.parse(quote.file_url) : [],
        fileNames: quote.file_name ? JSON.parse(quote.file_name) : [],
      }),
    })
    setReordering(false)
    setReorderModal(null)
    if (!res.ok) { alert('재구매 요청 저장에 실패했습니다.'); return }
    await loadData(user.id, dateFrom, dateTo)
    alert('재구매 견적 요청이 완료되었습니다!')
  }

  const cancelQuote = async (quoteId: string) => {
    if (!confirm('견적 요청을 취소하시겠습니까?')) return
    const res = await fetch('/api/admin/update-quote-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, status: 'cancelled' }),
    })
    if (res.ok) setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: 'cancelled' } : q))
    else alert('견적 취소에 실패했습니다.')
  }

  const requestRefund = async (quote: Quote) => {
    if (!quote.order_id) return
    const reason = prompt('환불 사유를 입력해주세요.')
    if (reason === null) return
    if (!reason.trim()) { alert('환불 사유를 입력해주세요.'); return }
    const res = await fetch('/api/admin/update-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: quote.order_id, status: 'refund_requested', refund_reason: reason.trim() }),
    })
    if (res.ok) {
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, order: { ...q.order!, status: 'refund_requested', refund_reason: reason.trim() } } : q))
      alert('환불 요청이 접수되었습니다. 담당자 확인 후 처리됩니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">내 주문 현황</h1>
        <button
          onClick={() => router.push('/quote/request')}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          + 새 견적 요청
        </button>
      </div>

      {/* 날짜 필터 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 space-y-3">
        {/* 빠른 선택 버튼 */}
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => applyQuickRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                quickRange === r
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {/* 날짜 직접 입력 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setQuickRange('' as QuickRange) }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-gray-400 text-sm shrink-0">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setQuickRange('' as QuickRange) }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={applyCustomRange}
            className="shrink-0 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            조회
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">해당 기간에 주문 내역이 없습니다.</p>
          <p className="text-xs text-gray-300 mb-6">{dateFrom} ~ {dateTo}</p>
          <button
            onClick={() => router.push('/quote/request')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            견적 요청하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 페이지당 개수 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-gray-500">총 {quotes.length}건</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 mr-1">페이지당</span>
              {[10, 30, 50, 100].map((n) => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${pageSize === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {pagedQuotes.map((quote) => {
            const displayStatus = getDisplayStatus(quote)
            const cfg = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending
            const StatusIcon = cfg.icon
            const isExpanded = expanded === quote.id

            return (
              <div key={quote.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* 요약 헤더 */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : quote.id)}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-gray-800">
                        {quote.order_name || PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type}
                      </span>
                      {quote.order_name && (
                        <span className="text-xs text-gray-400">{PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type}</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>
                        {new Date(quote.created_at).toLocaleDateString('ko-KR')}
                        {' '}
                        {new Date(quote.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {quote.total_amount && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-blue-600">{quote.total_amount.toLocaleString()}원</span>
                        </>
                      )}
                      {/* 송장 미리보기 */}
                      {quote.order?.tracking_number && (
                        <>
                          <span>·</span>
                          <span className="text-purple-600 font-semibold">{quote.order.carrier} {quote.order.tracking_number}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>

                {/* 상세 펼침 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 space-y-4">

                    {/* 요청 정보 */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">요청 내용</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">상품 유형</span><span className="text-gray-800">{PRODUCT_TYPE_LABEL[quote.product_type]}</span></div>
                        {(() => {
                          const files = parseFiles(quote.file_url, quote.file_name)
                          return files.length > 0 ? (
                            <div className="flex gap-2">
                              <span className="text-gray-400 w-20 shrink-0">시안 파일</span>
                              <div className="flex flex-col gap-1.5">
                                {files.map((f, i) => (
                                  <button key={i} onClick={() => downloadFile(f.url, f.name)}
                                    className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                    <Download className="w-3.5 h-3.5" />{f.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null
                        })()}
                        {quote.request_note && <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">요구사항</span><span className="text-gray-800">{quote.request_note}</span></div>}
                      </div>
                    </div>

                    {/* 확정 견적 */}
                    {quote.total_amount && !['pending', 'cancelled'].includes(quote.status) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-3">확정 견적</p>
                        <div className="space-y-1.5 text-sm">
                          {quote.quoted_quantity && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">출력 수량</span><span className="font-semibold text-gray-800">{quote.quoted_quantity}{quote.quoted_unit}</span></div>}
                          {quote.unit_price && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">단가</span><span className="text-gray-800">{quote.unit_price.toLocaleString()}원</span></div>}
                          {quote.cutting && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">컷팅</span><span className="text-gray-800">+{quote.cutting_price.toLocaleString()}원</span></div>}
                          <div className="flex gap-2 pt-2 border-t border-blue-200 mt-2">
                            <span className="text-gray-500 w-20 shrink-0">최종 금액</span>
                            <span className="font-bold text-blue-600 text-base">{quote.total_amount.toLocaleString()}원</span>
                          </div>
                          {quote.admin_note && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">담당자 메모</span><span className="text-gray-700">{quote.admin_note}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* 배송 정보 */}
                    {quote.order?.tracking_number && (
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-purple-700 uppercase mb-3">배송 정보</p>
                        <div className="space-y-1.5 text-sm">
                          {quote.order.carrier && <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">택배사</span><span className="font-semibold text-gray-800">{quote.order.carrier}</span></div>}
                          <div className="flex gap-2"><span className="text-gray-500 w-20 shrink-0">송장번호</span><span className="font-bold text-purple-700 tracking-wider">{quote.order.tracking_number}</span></div>
                        </div>
                      </div>
                    )}

                    {/* ── 상태별 안내 & 액션 ── */}

                    {/* 대기중 */}
                    {quote.status === 'pending' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                        시안 파일 검토 중입니다. 영업일 기준 1~2시간 내에 견적을 보내드립니다.
                      </div>
                    )}

                    {/* 결제 선택 (견적 완료) */}
                    {quote.status === 'quoted' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setPayMethod((p) => ({ ...p, [quote.id]: 'card' }))}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${(payMethod[quote.id] ?? 'card') === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            <CreditCard className="w-4 h-4" />카드 결제
                          </button>
                          <button onClick={() => setPayMethod((p) => ({ ...p, [quote.id]: 'bank' }))}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${payMethod[quote.id] === 'bank' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            <Building2 className="w-4 h-4" />무통장 입금
                          </button>
                        </div>

                        {payMethod[quote.id] === 'bank' && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-sm">
                            <p className="font-bold text-orange-800">무통장 입금 계좌 안내</p>
                            <div className="space-y-1 text-gray-700">
                              <div className="flex justify-between"><span className="text-gray-500">은행</span><span className="font-semibold">{BANK_INFO.bank}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-bold tracking-wider">{BANK_INFO.account}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">예금주</span><span className="font-semibold">{BANK_INFO.holder}</span></div>
                              <div className="flex justify-between border-t border-orange-200 pt-2 mt-2">
                                <span className="text-gray-500">입금 금액</span>
                                <span className="font-bold text-orange-700 text-base">{quote.total_amount?.toLocaleString()}원</span>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600">입금 후 버튼을 눌러주세요.</p>
                          </div>
                        )}

                        {(payMethod[quote.id] ?? 'card') === 'card' ? (
                          <button onClick={() => handlePay(quote)} disabled={paying === quote.id}
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">
                            {paying === quote.id ? '결제창 열는 중...' : `${quote.total_amount?.toLocaleString()}원 카드 결제하기`}
                          </button>
                        ) : (
                          <button onClick={() => handleBankTransfer(quote)} disabled={paying === quote.id}
                            className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm">
                            {paying === quote.id ? '처리 중...' : '입금 완료했습니다'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 무통장 입금 대기 */}
                    {quote.status === 'bank_transfer_pending' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-sm">
                        <p className="font-bold text-orange-800">입금 확인 중</p>
                        <div className="space-y-1 text-gray-700">
                          <div className="flex justify-between"><span className="text-gray-500">은행</span><span className="font-semibold">{BANK_INFO.bank}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-bold tracking-wider">{BANK_INFO.account}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">예금주</span><span className="font-semibold">{BANK_INFO.holder}</span></div>
                        </div>
                        <p className="text-xs text-orange-600">관리자가 입금 확인 후 작업을 시작합니다.</p>
                      </div>
                    )}

                    {/* 작업 장비 안내 (작업중 이후 단계에서 표시) */}
                    {quote.order?.assigned_machine && ['in_progress', 'shipped', 'delivered'].includes(quote.order.status) && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700 flex items-center justify-between">
                        <span>🖨️ 작업 장비</span>
                        <b className="text-base">{quote.order.assigned_machine}번</b>
                      </div>
                    )}

                    {/* 작업중 */}
                    {quote.order?.status === 'in_progress' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center text-sm text-yellow-800 font-medium">
                        현재 작업 중입니다.
                      </div>
                    )}

                    {/* 출고 완료 */}
                    {quote.order?.status === 'shipped' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center text-sm text-purple-700 font-medium">
                        출고가 완료되었습니다. 배송 정보를 확인해주세요.
                      </div>
                    )}

                    {/* 배송 완료 */}
                    {quote.order?.status === 'delivered' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-medium">
                        ✓ 배송이 완료되었습니다. 감사합니다!
                      </div>
                    )}

                    {/* 리뷰 쓰기 (배송완료 + 미작성) — 주문 레코드 없으면 견적 기준 */}
                    {displayStatus === 'delivered' && (
                      (quote.order_id ? reviewedOrderIds.includes(quote.order_id) : reviewedQuoteIds.includes(quote.id)) ? (
                        <div className="text-center text-xs text-gray-400 py-1">리뷰를 작성한 주문입니다.</div>
                      ) : (
                        <button onClick={() => openReview(quote.order_id, quote.id)}
                          className="w-full bg-yellow-400 text-yellow-900 py-2.5 rounded-xl text-sm font-bold hover:bg-yellow-500 transition-colors">
                          ★ 리뷰 쓰기
                        </button>
                      )
                    )}

                    {/* 환불 요청 */}
                    {quote.order?.status === 'refund_requested' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center text-sm text-orange-700">
                        환불 요청이 접수되었습니다. 담당자 검토 후 처리됩니다.
                      </div>
                    )}

                    {/* 환불 완료 */}
                    {quote.order?.status === 'refunded' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center text-sm text-gray-600">
                        환불이 완료되었습니다.
                      </div>
                    )}

                    {/* 결제 완료 후 환불 요청 버튼 */}
                    {quote.order && ['paid', 'in_progress'].includes(quote.order.status) && (
                      <button onClick={() => requestRefund(quote)}
                        className="w-full border border-orange-300 text-orange-600 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-50 transition-colors">
                        환불 요청
                      </button>
                    )}

                    {/* 재구매 버튼 — 주문 레코드 유무와 무관하게 표시 상태 기준 */}
                    {['delivered', 'paid', 'shipped', 'in_progress'].includes(displayStatus) && (
                      <button
                        onClick={() => setReorderModal({ quote, quantity: '' })}
                        className="w-full bg-gray-800 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors"
                      >
                        ↩ 재구매
                      </button>
                    )}

                    {/* 견적 취소 버튼 */}
                    {quote.status === 'pending' && (
                      <button onClick={() => cancelQuote(quote.id)}
                        className="w-full border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                        견적 요청 취소
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 text-center pt-2">총 {quotes.length}건</p>

          {/* 페이지 넘버링 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2 flex-wrap">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">이전</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
                .map((n, idx, arr) => (
                  <span key={n} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-gray-300">…</span>}
                    <button onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${safePage === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {n}
                    </button>
                  </span>
                ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* 재구매 모달 */}
    {reorderModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <h3 className="text-lg font-bold text-gray-800 mb-1">재구매</h3>
          <p className="text-sm text-gray-500 mb-5">
            이전과 동일한 시안으로 새 견적을 요청합니다.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">주문명</span>
              <span className="font-semibold text-gray-800">{reorderModal.quote.order_name || PRODUCT_TYPE_LABEL[reorderModal.quote.product_type]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">이전 단가</span>
              <span className="text-gray-800">{reorderModal.quote.unit_price?.toLocaleString()}원/{reorderModal.quote.quoted_unit}</span>
            </div>
          </div>
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              주문 수량 <span className="text-red-500">*</span>
              {reorderModal.quote.quoted_unit && <span className="text-gray-400 font-normal ml-1">({reorderModal.quote.quoted_unit} 단위)</span>}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={reorderModal.quantity}
              onChange={(e) => setReorderModal({ ...reorderModal, quantity: e.target.value })}
              placeholder={`예) 5${reorderModal.quote.quoted_unit || ''}`}
              autoFocus
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setReorderModal(null)}
              className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleReorder}
              disabled={reordering || !reorderModal.quantity.trim()}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {reordering ? '요청 중...' : '견적 요청'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 리뷰 작성 모달 */}
    {reviewModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">리뷰 작성</h2>
            <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <label className="text-sm font-semibold text-gray-700 block mb-2">별점</label>
          <div className="flex gap-1 mb-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setReviewRating(i)}>
                <Star className={`w-8 h-8 ${i <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>

          <label className="text-sm font-semibold text-gray-700 block mb-2">사진 <span className="text-gray-400 font-normal">(선택)</span></label>
          <div className="flex gap-2 flex-wrap mb-2">
            {reviewFiles.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <button onClick={() => setReviewFiles((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
              </div>
            ))}
            {reviewFiles.length < 5 && (
              <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-yellow-400">
                <Upload className="w-5 h-5 text-gray-400" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  const all = Array.from(e.target.files || [])
                  const tooBig = all.filter((f) => f.size > 50 * 1024 * 1024)
                  if (tooBig.length > 0) alert(`파일 1개당 최대 50MB까지 첨부할 수 있습니다.\n${tooBig.map((f) => `· ${f.name}`).join('\n')}`)
                  const sel = all.filter((f) => f.size <= 50 * 1024 * 1024)
                  setReviewFiles((p) => [...p, ...sel].slice(0, 5)); e.target.value = ''
                }} />
              </label>
            )}
          </div>

          <label className="text-sm font-semibold text-gray-700 block mb-2 mt-3">내용 <span className="text-gray-400 font-normal">(선택)</span></label>
          <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder="상품은 어떠셨나요?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-5" />

          <div className="flex gap-2">
            <button onClick={() => setReviewModal(null)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">취소</button>
            <button onClick={submitReview} disabled={reviewSubmitting} className="flex-1 bg-yellow-400 text-yellow-900 py-2.5 rounded-xl text-sm font-bold hover:bg-yellow-500 disabled:opacity-50">
              {reviewSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
