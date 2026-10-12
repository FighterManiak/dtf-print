'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Package, Search, Download, ChevronDown, ChevronUp, Truck, CheckCircle, Clock, CreditCard, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { safeRows, splitAddress } from '@/lib/excel-safe'

interface MaterialOrder {
  id: string; created_at: string; order_no: string | null
  user_name: string | null; user_email: string | null; user_phone: string | null; user_address: string | null
  order_name: string | null
  items: { materialId: string; name: string; price: number; qty: number }[]
  product_amount: number; shipping_fee: number; total_amount: number
  status: string; is_paid: boolean | null; payment_method: string | null
  carrier: string | null; tracking_number: string | null; memo: string | null
  payment_key?: string | null
  depositor_name?: string | null
  receipt_type?: string | null
  receipt_info?: Record<string, string> | null
  receipt_issued_at?: string | null
  receipt_doc_no?: string | null
}

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: '입금 대기', badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-400' },
  paid: { label: '결제 완료', badge: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  in_progress: { label: '준비 중', badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  shipped: { label: '출고', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  delivered: { label: '배송 완료', badge: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-600' },
  cancelled: { label: '취소', badge: 'bg-gray-100 text-gray-500 ring-gray-200', dot: 'bg-gray-400' },
}

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '입금 대기' },
  { key: 'paid', label: '결제 완료' },
  { key: 'in_progress', label: '준비 중' },
  { key: 'shipped', label: '출고' },
  { key: 'delivered', label: '배송 완료' },
  { key: 'cancelled', label: '취소' },
]

const NEXT: Record<string, { to: string; label: string }> = {
  pending: { to: 'paid', label: '입금 확인 → 결제완료' },
  paid: { to: 'in_progress', label: '준비 시작' },
  in_progress: { to: 'shipped', label: '출고 처리' },
  shipped: { to: 'delivered', label: '배송 완료' },
}

const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배', '쿠팡로켓', '기타']

// ?q= 로 검색어를 넘겨받기 위해 useSearchParams 를 쓰므로 Suspense 로 감쌈
export default function AdminMaterialOrdersPage() {
  return <Suspense><MaterialOrdersContent /></Suspense>
}

function MaterialOrdersContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  // 회원관리 주문내역에서 주문번호를 눌러 들어오면 검색어를 미리 채움
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [carrierIn, setCarrierIn] = useState<Record<string, string>>({})
  const [trackIn, setTrackIn] = useState<Record<string, string>>({})
  // 결제 취소 모달
  const [cancelTarget, setCancelTarget] = useState<MaterialOrder | null>(null)
  const [cancelForm, setCancelForm] = useState({ reason: '', amount: '', account: '', restock: true })
  const [cancelling, setCancelling] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/material-orders')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setOrders(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    setProcessing(id)
    const res = await fetch('/api/admin/material-orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    if (res.ok) load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || '처리 실패') }
    setProcessing(null)
  }

  const removeOrder = async (o: MaterialOrder) => {
    if (!confirm(`${o.user_name || '고객'} 님의 자재 주문을 삭제하시겠습니까?\n\n※ 삭제 기록(삭제자·시각·사유·원본)이 감사 로그에 남습니다.`)) return
    const reason = prompt('삭제 사유를 입력해주세요. (필수 · 기록에 남습니다)')
    if (reason === null) return
    if (!reason.trim()) { alert('삭제 사유를 입력해야 합니다.'); return }
    setProcessing(o.id)
    const res = await fetch(`/api/admin/material-orders?id=${o.id}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' })
    if (res.ok) load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || '삭제 실패') }
    setProcessing(null)
  }

  const openCancel = (o: MaterialOrder) => {
    setCancelTarget(o)
    setCancelForm({ reason: '', amount: String(o.total_amount || 0), account: '', restock: true })
  }

  const submitCancel = async () => {
    const o = cancelTarget
    if (!o) return
    const reason = cancelForm.reason.trim()
    if (!reason) { alert('취소 사유를 입력해주세요.'); return }
    const amount = Math.round(Number(cancelForm.amount) || 0)
    if (amount <= 0 || amount > o.total_amount) { alert(`취소 금액은 1원 ~ ${o.total_amount.toLocaleString()}원 사이로 입력해주세요.`); return }
    const isCard = o.payment_method === 'CARD'
    const partial = amount < o.total_amount
    const msg = isCard
      ? `카드 결제 ${partial ? '부분' : '전액'}취소 ${amount.toLocaleString()}원을 진행합니다.\n토스페이먼츠로 바로 취소 요청되며 되돌릴 수 없습니다. 계속할까요?`
      : `${partial ? '부분' : '전액'} 환불 ${amount.toLocaleString()}원으로 처리합니다.\n(무통장은 계좌로 직접 송금해주셔야 합니다) 계속할까요?`
    if (!confirm(msg)) return

    setCancelling(true)
    const res = await fetch('/api/admin/material-cancel-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, cancelReason: reason, cancelAmount: amount, refundAccount: cancelForm.account, restock: cancelForm.restock }),
    })
    const d = await res.json().catch(() => ({}))
    setCancelling(false)
    if (!res.ok) { alert(d.error || '취소 실패'); return }
    alert(d.partial
      ? `부분 ${isCard ? '취소' : '환불'} ${amount.toLocaleString()}원 처리했습니다.`
      : `주문을 취소했습니다.${d.restocked ? ` (재고 ${d.restocked}개 품목 복구)` : ''}`)
    setCancelTarget(null)
    load()
  }

  const filtered = orders.filter((o) => {
    if (tab !== 'all' && o.status !== tab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (o.order_no || '').toLowerCase().includes(q) ||
      (o.user_name || '').toLowerCase().includes(q) ||
      (o.user_phone || '').includes(q) ||
      (o.user_email || '').toLowerCase().includes(q) ||
      (o.order_name || '').toLowerCase().includes(q) ||
      (o.tracking_number || '').includes(q)
    )
  })

  const counts: Record<string, number> = {}
  orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1 })

  const unpaidCount = orders.filter((o) => o.is_paid === false).length
  const revenue = orders
    .filter((o) => ['paid', 'in_progress', 'shipped', 'delivered'].includes(o.status) && o.is_paid !== false)
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  const exportExcel = () => {
    const headers = ['주문번호', '주문일시', '상태', '주문자', '연락처', '이메일', '우편번호', '주소', '상품', '수량', '상품금액', '배송비', '결제금액', '결제수단', '입금여부', '택배사', '송장번호']
    const rows = filtered.map((o) => [
      o.order_no || '',
      new Date(o.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      STATUS[o.status]?.label || o.status,
      o.user_name || '', o.user_phone || '', o.user_email || '',
      splitAddress(o.user_address).zip, splitAddress(o.user_address).addr,
      (o.items || []).map((i) => i.name).join(', '),
      // 품목이 하나면 숫자로 넣어 엑셀에서 합계·정렬이 가능하게 함
      (o.items || []).length === 1 ? o.items[0].qty : (o.items || []).map((i) => i.qty).join(', '),
      o.product_amount || 0, o.shipping_fee || 0, o.total_amount || 0,
      o.payment_method === 'CARD' ? '카드' : '무통장',
      o.is_paid === false ? '미입금' : '입금완료',
      // 직접 수령은 택배사가 없으므로 '직접수령'으로 표기
      String(o.user_address || '').includes('직접 수령') ? '직접수령' : (o.carrier || ''),
      o.tracking_number || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...safeRows(rows)])
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 34 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '자재주문')
    XLSX.writeFile(wb, `자재주문_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">자재 주문 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 {orders.length}건</p>
          </div>
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> 엑셀 다운로드 ({filtered.length})
          </button>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">입금 대기</p>
            <p className="text-lg font-bold text-orange-600">{counts.pending || 0}건</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">미입금(후불)</p>
            <p className={`text-lg font-bold ${unpaidCount > 0 ? 'text-red-500' : 'text-gray-800'}`}>{unpaidCount}건</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">누적 매출</p>
            <p className="text-lg font-bold text-gray-900">{revenue.toLocaleString()}원</p>
          </div>
        </div>

        {/* 검색 */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="주문번호, 주문자, 연락처, 이메일, 주문명, 송장번호 검색"
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-400" />
        </div>

        {/* 탭 */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {TABS.map(({ key, label }) => {
            const cnt = key === 'all' ? orders.length : (counts[key] || 0)
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {label}
                {cnt > 0 && <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* 목록 */}
        {loading ? (
          <p className="text-center py-20 text-gray-400 text-sm">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-20">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">해당하는 주문이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((o) => {
              const cfg = STATUS[o.status] || STATUS.pending
              const open = expanded === o.id
              const next = NEXT[o.status]
              return (
                <div key={o.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* 헤더 */}
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(open ? null : o.id)}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {o.order_no && (
                          <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{o.order_no}</span>
                        )}
                        <span className="font-bold text-gray-900 text-sm">{o.user_name || '—'}</span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ${cfg.badge}`}>{cfg.label}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${o.payment_method === 'CARD' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                          {o.payment_method === 'CARD' ? '카드' : '무통장'}
                        </span>
                        {o.is_paid === false && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">미입금</span>}
                        {/* 증빙 요청과 발행 여부 */}
                        {o.receipt_type && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${o.receipt_issued_at ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}
                            title={o.receipt_doc_no ? `문서번호 ${o.receipt_doc_no}` : undefined}>
                            🧾 {o.receipt_type === 'tax_invoice' ? '세금계산서' : '현금영수증'} {o.receipt_issued_at ? '발행 완료' : '미발행'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                        <span className="font-semibold text-gray-700">{o.order_name}</span>
                        <span className="font-bold text-blue-600">{o.total_amount.toLocaleString()}원</span>
                        {o.payment_method !== 'CARD' && o.depositor_name && (
                          <span className={o.depositor_name !== o.user_name ? 'text-amber-600 font-semibold' : ''}>입금 {o.depositor_name}</span>
                        )}
                        {o.user_phone && <span>{o.user_phone}</span>}
                        <span>{new Date(o.created_at).toLocaleDateString('ko-KR')}</span>
                        {o.tracking_number && <span className="text-indigo-600 font-semibold">{o.carrier} {o.tracking_number}</span>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeOrder(o) }} disabled={processing === o.id}
                      className="shrink-0 text-xs text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg px-2 py-1 font-semibold transition-colors disabled:opacity-50">삭제</button>
                    {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </div>

                  {/* 상세 */}
                  {open && (
                    <div className="border-t border-gray-100 p-5 space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* 주문 정보 */}
                        <div className="rounded-xl border border-gray-200 p-4">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 정보</p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">이름</span><span className="text-gray-900">{o.user_name || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">연락처</span><span className="text-gray-900">{o.user_phone || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">이메일</span><span className="text-gray-900 break-all">{o.user_email || '—'}</span></div>
                            <div className="flex gap-2"><span className="text-gray-500 w-14 shrink-0">배송지</span><span className="text-gray-900">{o.user_address || '—'}</span></div>
                          </div>
                        </div>

                        {/* 주문 상품 */}
                        <div className="rounded-xl border border-gray-200 p-4">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-3">주문 상품</p>
                          <div className="space-y-1.5 text-sm">
                            {(o.items || []).map((it, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="text-gray-700">{it.name} × {it.qty}</span>
                                <span className="font-semibold text-gray-900">{(it.price * it.qty).toLocaleString()}원</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-gray-500 border-t border-gray-100 pt-1.5 mt-1.5">
                              <span>배송비</span><span>{o.shipping_fee === 0 ? '무료' : `${o.shipping_fee.toLocaleString()}원`}</span>
                            </div>
                            <div className="flex justify-between font-bold text-blue-700 border-t border-gray-100 pt-1.5">
                              <span>결제 금액</span><span>{o.total_amount.toLocaleString()}원</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {o.memo && (
                        <div className="rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2">
                          <span className="text-[11px] font-bold text-red-600">📌 메모 / 요청사항</span>
                          <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{o.memo}</p>
                        </div>
                      )}

                      {/* 송장 등록 */}
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-3">송장 등록</p>
                        <div className="flex gap-2 flex-wrap">
                          <select value={carrierIn[o.id] ?? o.carrier ?? ''} onChange={(e) => setCarrierIn((p) => ({ ...p, [o.id]: e.target.value }))}
                            className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white">
                            <option value="">택배사 선택</option>
                            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input value={trackIn[o.id] ?? o.tracking_number ?? ''} onChange={(e) => setTrackIn((p) => ({ ...p, [o.id]: e.target.value }))}
                            placeholder="송장번호"
                            className="flex-1 min-w-[140px] border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
                          <button onClick={() => patch(o.id, { carrier: carrierIn[o.id] ?? o.carrier, trackingNumber: trackIn[o.id] ?? o.tracking_number })}
                            disabled={processing === o.id}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                            <Truck className="w-4 h-4 inline mr-1" />저장
                          </button>
                        </div>
                      </div>

                      {/* 액션 */}
                      <div className="flex gap-2 flex-wrap">
                        {next && (
                          <button onClick={() => patch(o.id, { status: next.to })} disabled={processing === o.id}
                            className="flex-1 min-w-[160px] bg-violet-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                            {next.label} →
                          </button>
                        )}
                        {o.is_paid === false ? (
                          <button onClick={() => patch(o.id, { isPaid: true })} disabled={processing === o.id}
                            className="bg-emerald-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                            <CheckCircle className="w-4 h-4 inline mr-1" />입금완료 처리
                          </button>
                        ) : (
                          <button onClick={() => patch(o.id, { isPaid: false })} disabled={processing === o.id}
                            className="border border-gray-300 text-gray-500 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                            <CreditCard className="w-4 h-4 inline mr-1" />미입금으로 변경
                          </button>
                        )}
                        {o.status !== 'cancelled' && (
                          <button onClick={() => openCancel(o)} disabled={processing === o.id}
                            className="border border-gray-300 text-gray-500 px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-300 disabled:opacity-50">
                            <XCircle className="w-4 h-4 inline mr-1" />{o.payment_method === 'CARD' ? '결제 취소' : o.is_paid === false || o.status === 'pending' ? '주문 취소' : '취소·환불'}
                          </button>
                        )}
                        {/* 카드 결제는 취소 후 되돌릴 수 없으므로 복구 버튼을 보이지 않음 */}
                        {o.status === 'cancelled' && o.payment_method !== 'CARD' && (
                          <button onClick={() => patch(o.id, { status: 'pending' })} disabled={processing === o.id}
                            className="border border-gray-300 text-gray-600 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                            <Clock className="w-4 h-4 inline mr-1" />입금대기로 복구
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 결제 취소 모달 */}
      {cancelTarget && (() => {
        const o = cancelTarget
        const isCard = o.payment_method === 'CARD'
        const unpaid = !isCard && (o.is_paid === false || o.status === 'pending')
        const amount = Math.round(Number(cancelForm.amount) || 0)
        const partial = amount > 0 && amount < o.total_amount
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !cancelling && setCancelTarget(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {isCard ? '카드 결제 취소' : unpaid ? '주문 취소' : '취소 · 환불 처리'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {o.order_no ? `#${o.order_no} · ` : ''}{o.user_name || '고객'} · {o.order_name} · 결제 {o.total_amount.toLocaleString()}원
              </p>

              <div className={`text-xs rounded-lg px-3 py-2 mb-4 ${isCard ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                {isCard
                  ? o.payment_key
                    ? '토스페이먼츠로 바로 취소 요청됩니다. 고객 카드사에 따라 3~7영업일 내 환불됩니다.'
                    : '⚠ 결제 키가 없는 주문이라 자동 취소가 되지 않습니다. 토스 대시보드에서 결제 여부를 확인해주세요.'
                  : unpaid
                    ? '입금 전 주문이라 환불할 금액이 없습니다. 주문만 취소됩니다.'
                    : '무통장 입금 건은 자동 환불이 되지 않습니다. 기록 후 고객 계좌로 직접 송금해주세요.'}
              </div>

              <div className="space-y-3">
                {!unpaid && (
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">{isCard ? '취소 금액' : '환불 금액'} (원)</span>
                    <input type="number" min={1} max={o.total_amount} value={cancelForm.amount}
                      onChange={(e) => setCancelForm((p) => ({ ...p, amount: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
                    <span className="text-[11px] text-gray-400">
                      {partial ? `부분 ${isCard ? '취소' : '환불'} — 주문 상태는 그대로 유지됩니다.` : '전액 — 주문이 취소 상태로 바뀝니다.'}
                    </span>
                  </label>
                )}
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">취소 사유 (필수)</span>
                  <input value={cancelForm.reason} onChange={(e) => setCancelForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="예: 고객 요청, 재고 부족, 중복 주문"
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
                </label>
                {!isCard && !unpaid && (
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">환불 계좌 (선택)</span>
                    <input value={cancelForm.account} onChange={(e) => setCancelForm((p) => ({ ...p, account: e.target.value }))}
                      placeholder="은행 / 계좌번호 / 예금주"
                      className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
                  </label>
                )}
                {(unpaid || !partial) && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={cancelForm.restock} onChange={(e) => setCancelForm((p) => ({ ...p, restock: e.target.checked }))} />
                    주문 수량만큼 재고 되돌리기
                  </label>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">닫기</button>
                <button onClick={submitCancel} disabled={cancelling}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                  {cancelling ? '처리 중...' : isCard ? `${partial ? '부분' : '전액'} 취소` : unpaid ? '주문 취소' : `${partial ? '부분' : '전액'} 환불 기록`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
