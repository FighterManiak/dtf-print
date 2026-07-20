'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, CheckCircle, Clock, CreditCard, XCircle, ChevronDown, ChevronUp, Send, Truck, Package, RotateCcw, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

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
  { key: 'order_pending',        label: '입금 대기' },
  { key: 'paid',                 label: '결제 완료' },
  { key: 'in_progress',          label: '작업 중' },
  { key: 'shipped',              label: '출고' },
  { key: 'delivered',            label: '배송 완료' },
  { key: 'refund_requested',     label: '환불 요청' },
  { key: 'cancelled',            label: '취소' },
] as const

// 하나의 탭이 여러 상태를 포함 (결제완료 = 입금확인 + 결제완료)
const TAB_STATUSES: Record<string, string[]> = {
  paid: ['paid', 'bank_transfer_pending'],
}

interface OrderInfo {
  id: string; status: string; carrier: string | null
  tracking_number: string | null; refund_reason: string | null
  payment_method: string | null; assigned_machine: number | null
}
interface Quote {
  id: string; created_at: string; status: string
  user_name: string | null; user_email: string | null; user_phone: string | null; user_address: string | null
  product_type: string; order_name: string | null; request_note: string | null
  file_url: string | null; file_name: string | null
  quoted_quantity: number | null; quoted_unit: string | null
  cutting: boolean; cutting_price: number; unit_price: number | null; total_amount: number | null
  admin_note: string | null; order_id: string | null; order?: OrderInfo | null
  machine_no: number | null
}
interface DirectOrder {
  id: string; created_at: string; status: string
  user_name: string | null; user_email: string | null; user_phone: string | null; user_address: string | null
  order_name: string | null; total_amount: number; carrier: string | null; tracking_number: string | null
  memo: string | null; refund_reason: string | null; payment_method: string | null; machine_no: number | null; assigned_machine: number | null
  order_items: { id: string; product_id: string; quantity: number; unit_price: number; cutting: boolean; cutting_price: number; request_note: string | null; file_url: string | null; file_name: string | null }[]
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

function AdminManagePageContent() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>(searchParams.get('status') || 'all')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(30)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, QuoteForm>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [memoInputs, setMemoInputs] = useState<Record<string, string>>({})
  const [memoSaving, setMemoSaving] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [zipping, setZipping] = useState<string | null>(null)

  // 작업 시작 시 장비 지정 모달
  const [machineModal, setMachineModal] = useState<{ orderId: string; itemKey: string; requested: number; value: number } | null>(null)
  const MACHINE_COUNT = 10
  const ACTIVE_MACHINE_COUNT = 6

  const confirmStartWork = async () => {
    if (!machineModal) return
    if (!machineModal.value) { alert('작업할 장비 번호를 선택해주세요.'); return }
    setProcessing(machineModal.itemKey)
    const res = await fetch('/api/admin/update-order-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: machineModal.orderId, status: 'in_progress', assignedMachine: machineModal.value }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || '처리 실패') }
    setMachineModal(null)
    await loadAll()
    setProcessing(null)
  }

  const BULK_NEXT: Record<string, string> = { paid: 'in_progress', in_progress: 'shipped', shipped: 'delivered' }
  const BULK_NEXT_LABEL: Record<string, string> = { in_progress: '작업 시작', shipped: '출고 진행', delivered: '배송 완료' }

  const toggleSelect = (key: string) => setSelected((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })

  // 한 주문을 다음 단계로 이동
  const advanceItem = async (item: Item): Promise<boolean> => {
    const d = item.data
    const s = getEffectiveStatus(item)
    const next = BULK_NEXT[s]
    if (!next) return false
    const orderId = item.type === 'quote' ? (d as Quote).order_id : d.id
    if (orderId) {
      const res = await fetch('/api/admin/update-order-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, status: next }) })
      return res.ok
    }
    if (item.type === 'quote') {
      let res = await fetch('/api/admin/confirm-bank-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: d.id, targetStatus: next }) })
      if (!res.ok) res = await fetch('/api/admin/update-quote-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: d.id, status: next }) })
      return res.ok
    }
    return false
  }

  const advanceSelected = async () => {
    const targets = filtered.filter((item) => {
      const key = item.type === 'quote' ? `q-${item.data.id}` : `o-${item.data.id}`
      return selected.has(key) && BULK_NEXT[getEffectiveStatus(item)]
    })
    if (targets.length === 0) { alert('다음 단계로 넘길 수 있는 주문이 없습니다.\n(결제완료·작업중·출고 상태만 가능)'); return }
    if (!confirm(`선택한 ${targets.length}건을 각각 다음 단계로 넘기시겠습니까?`)) return
    setBulkRunning(true)
    let ok = 0
    for (const item of targets) { if (await advanceItem(item)) ok++ }
    setBulkRunning(false)
    setSelected(new Set())
    await loadAll()
    alert(`${ok}건 처리 완료${ok < targets.length ? ` (${targets.length - ok}건 실패)` : ''}`)
  }

  // 취소/환불 모달
  const [cancelModal, setCancelModal] = useState<{ orderId: string; itemKey: string; total: number; isCard: boolean } | null>(null)
  const [cancelAmount, setCancelAmount] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [refundAccount, setRefundAccount] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const openCancelModal = (orderId: string, itemKey: string, total: number, isCard: boolean) => {
    setCancelModal({ orderId, itemKey, total, isCard })
    setCancelAmount(String(total))
    setCancelReason('')
    setRefundAccount('')
    setCancelError('')
  }

  const submitCancel = async () => {
    if (!cancelModal) return
    if (!cancelReason.trim()) { setCancelError('취소 사유를 입력해주세요.'); return }
    const amt = Number(cancelAmount)
    if (!amt || amt <= 0 || amt > cancelModal.total) { setCancelError('취소 금액이 올바르지 않습니다.'); return }
    setCancelLoading(true)
    setCancelError('')
    const res = await fetch('/api/admin/cancel-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: cancelModal.orderId, cancelReason: cancelReason.trim(), cancelAmount: amt, refundAccount: refundAccount.trim() || undefined }),
    })
    if (res.ok) {
      setCancelModal(null)
      await loadAll()
    } else {
      const err = await res.json().catch(() => ({}))
      setCancelError(err.error || '취소 처리에 실패했습니다.')
    }
    setCancelLoading(false)
  }

  useEffect(() => { loadAll() }, [])
  // 필터/검색/페이지크기 변경 시 1페이지로
  useEffect(() => { setPage(1) }, [tab, search, dateFrom, dateTo, pageSize])

  const loadAll = async () => {
    setLoading(true)
    // quotes / orders 모두 RLS 우회를 위해 서비스롤 API로 조회
    const [quotesData, directData]: [Quote[], DirectOrder[]] = await Promise.all([
      fetch('/api/admin/list-quotes').then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/admin/list-orders').then((r) => r.ok ? r.json() : []).catch(() => []),
    ])
    const orderIds = (quotesData || []).map((q) => q.order_id).filter(Boolean) as string[]
    const ordersMap: Record<string, OrderInfo> = {}
    directData.forEach((o) => { ordersMap[o.id] = o })
    const quoteItems: Item[] = (quotesData || []).map((q) => ({ type: 'quote' as const, data: { ...q, order: q.order_id ? (ordersMap[q.order_id] ?? null) : null } }))
    const linkedSet = new Set(orderIds)
    const directItems: Item[] = directData.filter((o) => !linkedSet.has(o.id)).map((o) => ({ type: 'order' as const, data: o }))
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
    // 카카오 알림톡 발송 (환경변수 설정 시에만 실제 전송)
    if (quote.user_phone) {
      await fetch('/api/send-quote-alimtalk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: quote.user_name || '고객', userPhone: quote.user_phone, productType: PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type, totalAmount: total }) }).catch(() => {})
    }
    await loadAll(); setSending(null)
  }

  const updateOrderStatus = async (orderId: string, status: string, itemKey?: string) => {
    setProcessing(itemKey || orderId)
    const res = await fetch('/api/admin/update-order-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, status }) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`상태 변경 실패: ${err.error || res.status}\norderId: ${orderId}`)
    }
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

  // 시안 파일 전체를 ZIP으로 묶어 다운로드
  const downloadAllFiles = async (files: { url: string; name: string }[], customerName: string, key: string) => {
    if (files.length === 0) return
    setZipping(key)
    try {
      const supabase = createClient()
      const zip = new JSZip()
      const safeName = (customerName || '고객').replace(/[\\/:*?"<>|]/g, '')
      let added = 0

      for (let i = 0; i < files.length; i++) {
        const { data } = await supabase.storage.from('order-files').createSignedUrl(files[i].url, 300)
        if (!data?.signedUrl) continue
        const res = await fetch(data.signedUrl)
        if (!res.ok) continue
        const blob = await res.blob()
        const ext = files[i].name.split('.').pop() || files[i].url.split('.').pop() || 'bin'
        zip.file(`${safeName}_${i + 1}.${ext}`, blob)
        added++
      }

      if (added === 0) { alert('내려받을 수 있는 파일이 없습니다.'); setZipping(null); return }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const objectUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `${safeName}_시안파일.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      alert('전체 다운로드 중 오류가 발생했습니다.')
    }
    setZipping(null)
  }

  const parseFiles = (fileUrl: string | null, fileName: string | null) => {
    if (!fileUrl || !fileName) return []
    try { return (JSON.parse(fileUrl) as string[]).map((url, i) => ({ url, name: (JSON.parse(fileName) as string[])[i] || `파일 ${i+1}` })) }
    catch { return [{ url: fileUrl, name: fileName }] }
  }

  const filtered = items.filter((item) => {
    const s = getEffectiveStatus(item)
    if (tab !== 'all' && !(TAB_STATUSES[tab] || [tab]).includes(s)) return false
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

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // 현재 필터된 주문 내역을 엑셀(CSV)로 다운로드
  const exportExcel = () => {
    const headers = ['주문일시', '유형', '상태', '이름', '연락처', '이메일', '주소', '상품/상세', '요청장비', '작업장비', '결제수단', '금액', '택배사', '송장번호']
    const rows = filtered.map((item) => {
      const d = item.data
      const s = getEffectiveStatus(item)
      const label = STATUS_CONFIG[s]?.label || s
      const type = item.type === 'quote' ? '견적주문' : '바로주문'
      const pm = item.type === 'quote' ? (d as Quote).order?.payment_method : (d as DirectOrder).payment_method
      const pmLabel = pm === 'bank_transfer' ? '무통장' : pm === 'CARD' || pm === 'card' ? '카드' : ''
      const carrier = (item.type === 'quote' ? (d as Quote).order?.carrier : (d as DirectOrder).carrier) || ''
      const tracking = (item.type === 'quote' ? (d as Quote).order?.tracking_number : (d as DirectOrder).tracking_number) || ''
      let detail = ''
      if (item.type === 'quote') detail = PRODUCT_TYPE_LABEL[(d as Quote).product_type] || (d as Quote).product_type
      else detail = ((d as DirectOrder).order_items || []).map((oi) => `${oi.product_id}×${oi.quantity}`).join(', ')
      const machine = (d as { machine_no?: number | null }).machine_no
      const assigned = item.type === 'quote' ? (d as Quote).order?.assigned_machine : (d as DirectOrder).assigned_machine
      const createdAt = new Date(d.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      return [createdAt, type, label, d.user_name || '', d.user_phone || '', d.user_email || '', d.user_address || '', detail, machine ? `${machine}번` : '자동 배정', assigned ? `${assigned}번` : '', pmLabel, d.total_amount || 0, carrier, tracking]
    })
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    // 열 너비 지정
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '주문내역')
    XLSX.writeFile(wb, `주문내역_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 송장 일괄등록 양식 다운로드 (송장 입력이 필요한 주문 = 주문ID 있는 결제완료·작업중·출고)
  const exportShippingTemplate = () => {
    const shippable = filtered.filter((item) => {
      const orderId = item.type === 'quote' ? (item.data as Quote).order_id : item.data.id
      return orderId && ['paid', 'in_progress', 'shipped'].includes(getEffectiveStatus(item))
    })
    if (shippable.length === 0) { alert('송장 등록 대상 주문이 없습니다.\n(주문ID가 있는 결제완료·작업중·출고 주문만 대상)'); return }
    const headers = ['주문ID', '이름', '연락처', '주문명', '상태', '택배사', '송장번호']
    const rows = shippable.map((item) => {
      const d = item.data
      const orderId = item.type === 'quote' ? (d as Quote).order_id : d.id
      const label = STATUS_CONFIG[getEffectiveStatus(item)]?.label || ''
      return [orderId, d.user_name || '', d.user_phone || '', (d as { order_name?: string }).order_name || '', label, '', '']
    })
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '송장등록')
    XLSX.writeFile(wb, `송장양식_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 송장 엑셀 업로드 → 일괄 등록
  const importTracking = async (file: File) => {
    setBulkRunning(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      const rows = json
        .map((r) => ({
          orderId: String(r['주문ID'] ?? '').trim(),
          carrier: String(r['택배사'] ?? '').trim(),
          tracking_number: String(r['송장번호'] ?? '').trim(),
        }))
        .filter((r) => r.orderId && r.tracking_number)
      if (rows.length === 0) { alert('송장번호가 입력된 행이 없습니다.\n양식의 "송장번호" 열을 채웠는지 확인해주세요.'); setBulkRunning(false); return }
      const res = await fetch('/api/admin/bulk-tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
      const data = await res.json()
      if (res.ok) {
        await loadAll()
        alert(`송장 ${data.updated}건 등록 완료 (출고 처리)${data.failed?.length ? `\n실패 ${data.failed.length}건 (주문ID 불일치)` : ''}`)
      } else {
        alert(data.error || '일괄 등록 실패')
      }
    } catch {
      alert('엑셀 파일을 읽지 못했습니다. 양식 파일인지 확인해주세요.')
    }
    setBulkRunning(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">주문 관리 <span className="text-xs text-gray-400 font-normal">v7</span></h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 {items.length}건</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={exportExcel} disabled={filtered.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40">
              <Download className="w-4 h-4" /> 엑셀 다운로드 ({filtered.length})
            </button>
            <button onClick={exportShippingTemplate}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> 송장 양식
            </button>
            <label className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors cursor-pointer">
              <Truck className="w-4 h-4" /> {bulkRunning ? '처리 중...' : '송장 일괄등록'}
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={bulkRunning}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importTracking(f); e.target.value = '' }} />
            </label>
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
            const cnt = key === 'all' ? items.length : (TAB_STATUSES[key] || [key]).reduce((sum, s) => sum + (counts[s] || 0), 0)
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

        {/* 페이지당 개수 + 결과 수 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-sm text-gray-500">총 {filtered.length}건</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">페이지당</span>
            {[30, 50, 100, 500].map((n) => (
              <button key={n} onClick={() => setPageSize(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${pageSize === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="text-center py-24 text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-sm">해당하는 주문이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {paged.map((item) => {
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
                    {/* 일괄 선택 체크박스 */}
                    <input type="checkbox" checked={selected.has(itemKey)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(itemKey)}
                      className="w-4 h-4 accent-gray-900 shrink-0 cursor-pointer" />
                    {/* 상태 도트 */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{d.user_name || d.user_email || '—'}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${item.type === 'quote' ? 'bg-blue-50 text-blue-600 ring-blue-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                          {item.type === 'quote' ? '📋 견적주문' : '⚡ 바로주문'}
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
                        {(() => {
                          const pm = item.type === 'quote' ? (d as Quote).order?.payment_method : (d as DirectOrder).payment_method
                          if (!pm) return null
                          const isBank = pm === 'bank_transfer'
                          return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isBank ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{isBank ? '무통장' : '카드'}</span>
                        })()}
                        {d.user_phone && <span className="text-xs text-gray-400">{d.user_phone}</span>}
                        {(() => {
                          const assigned = item.type === 'quote' ? (d as Quote).order?.assigned_machine : (d as DirectOrder).assigned_machine
                          const m = (d as { machine_no?: number | null }).machine_no
                          if (assigned) return <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">작업 {assigned}번</span>
                          return m ? <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">요청 {m}번</span> : null
                        })()}
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
                            {(() => {
                              const pm = item.type === 'quote' ? (d as Quote).order?.payment_method : (d as DirectOrder).payment_method
                              if (!pm) return null
                              const isBank = pm === 'bank_transfer'
                              return <div className="flex gap-3"><span className="w-12 shrink-0 text-gray-400">결제</span><span className={`font-semibold ${isBank ? 'text-orange-600' : 'text-blue-600'}`}>{isBank ? '🏦 무통장 입금' : '💳 카드 결제'}</span></div>
                            })()}
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

                      {/* 파일 다운로드 (견적) */}
                      {item.type === 'quote' && (() => {
                        const files = parseFiles((d as Quote).file_url, (d as Quote).file_name)
                        return files.length > 0 ? (
                          <div className="space-y-2">
                            {files.length > 1 && (
                              <button onClick={() => downloadAllFiles(files, d.user_name || '고객', itemKey)} disabled={zipping === itemKey}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" />
                                {zipping === itemKey ? '압축 중...' : `전체 다운로드 (ZIP · ${files.length}개)`}
                              </button>
                            )}
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

                      {/* 파일 다운로드 (바로주문) */}
                      {item.type === 'order' && (() => {
                        const files = ((d as DirectOrder).order_items || []).filter((oi) => oi.file_url).map((oi) => ({ url: oi.file_url as string, name: oi.file_name || oi.product_id }))
                        return files.length > 0 ? (
                          <div className="space-y-2">
                            {files.length > 1 && (
                              <button onClick={() => downloadAllFiles(files, d.user_name || '고객', itemKey)} disabled={zipping === itemKey}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-50">
                                <Download className="w-4 h-4" />
                                {zipping === itemKey ? '압축 중...' : `전체 다운로드 (ZIP · ${files.length}개)`}
                              </button>
                            )}
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
                            {quote.status === 'quoted' && (
                              <button onClick={async () => {
                                if (!confirm('고객 미응답으로 취소 처리하시겠습니까?')) return
                                const supabase = createClient()
                                await supabase.from('quotes').update({ status: 'cancelled' }).eq('id', quote.id)
                                await loadAll()
                              }} className="mt-3 w-full border border-gray-300 text-gray-500 py-2 rounded-xl text-xs font-medium hover:bg-gray-50 hover:border-red-300 hover:text-red-500 transition-colors">
                                고객 미응답 — 취소 처리
                              </button>
                            )}
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
                        // 견적 주문: order_id 없어도 quote 자체 status가 paid면 버튼 표시
                        const orderStatus = item.type === 'quote'
                          ? ((d as Quote).order?.status || (d as Quote).status || null)
                          : (d as DirectOrder).status
                        if (!orderStatus) return null
                        // orderId 없는 견적 paid → order 없으므로 직접 처리 불가 안내 대신 order 생성 후 진행
                        if (item.type === 'quote' && !orderId && ['paid', 'in_progress', 'shipped'].includes(orderStatus)) {
                          const Q_NEXT: Record<string, string> = { paid: 'in_progress', in_progress: 'shipped', shipped: 'delivered' }
                          const Q_LABEL: Record<string, string> = { paid: '작업 시작', in_progress: '출고 진행', shipped: '배송 완료 처리' }
                          const Q_COLOR: Record<string, string> = { paid: 'bg-violet-600 hover:bg-violet-700', in_progress: 'bg-indigo-600 hover:bg-indigo-700', shipped: 'bg-green-600 hover:bg-green-700' }
                          const createAndGo = async (targetStatus: string, label: string) => {
                            if (!confirm(`${label} 처리하시겠습니까?`)) return
                            setProcessing(itemKey)
                            let res = await fetch('/api/admin/confirm-bank-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: d.id, targetStatus }) })
                            if (!res.ok) {
                              res = await fetch('/api/admin/update-quote-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: d.id, status: targetStatus }) })
                            }
                            if (res.ok) await loadAll()
                            else {
                              const errText = await res.text().catch(() => '')
                              let errMsg = String(res.status)
                              try { errMsg = JSON.parse(errText).error || errMsg } catch {}
                              alert(`처리 중 오류가 발생했습니다.\n오류: ${errMsg}`)
                            }
                            setProcessing(null)
                          }
                          return (
                            <div className="space-y-2">
                              {Q_NEXT[orderStatus] && (
                                <button onClick={() => createAndGo(Q_NEXT[orderStatus], Q_LABEL[orderStatus])} disabled={processing === itemKey}
                                  className={`w-full text-white py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${Q_COLOR[orderStatus]}`}>
                                  {Q_LABEL[orderStatus]} →
                                </button>
                              )}
                              {orderStatus !== 'shipped' && (
                                <button onClick={() => createAndGo('delivered', '바로 배송 완료')} disabled={processing === itemKey}
                                  className="w-full border border-green-300 text-green-700 py-2.5 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                                  바로 배송 완료 처리
                                </button>
                              )}
                            </div>
                          )
                        }
                        if (!orderId) return null
                        if (!['paid', 'in_progress', 'shipped', 'refund_requested'].includes(orderStatus)) return null

                        const NEXT: Record<string, string> = { paid: 'in_progress', in_progress: 'shipped', shipped: 'delivered' }
                        const NEXT_LABEL: Record<string, string> = { paid: '작업 시작', in_progress: '출고 진행 →', shipped: '배송 완료 처리' }
                        const NEXT_COLOR: Record<string, string> = { paid: 'bg-violet-600 hover:bg-violet-700', in_progress: 'bg-indigo-600 hover:bg-indigo-700', shipped: 'bg-green-600 hover:bg-green-700' }

                        return (
                          <div className="space-y-3">
                            {NEXT[orderStatus] && (
                              <button onClick={async () => {
                                // 작업 시작(paid → in_progress) 시에는 장비 지정 모달
                                if (orderStatus === 'paid') {
                                  const requested = (d as { machine_no?: number | null }).machine_no || 0
                                  const current = (d as { assigned_machine?: number | null }).assigned_machine || requested
                                  setMachineModal({ orderId, itemKey, requested, value: current })
                                  return
                                }
                                if (confirm(`'${NEXT_LABEL[orderStatus]}'으로 변경하시겠습니까?`)) await updateOrderStatus(orderId, NEXT[orderStatus], itemKey)
                              }}
                                disabled={processing === itemKey}
                                className={`w-full text-white py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${NEXT_COLOR[orderStatus] || 'bg-gray-700 hover:bg-gray-800'}`}>
                                {NEXT_LABEL[orderStatus]} →
                              </button>
                            )}
                            {orderStatus === 'paid' && (
                              <button onClick={async () => {
                                console.log('[배송완료] orderId:', orderId, 'orderStatus:', orderStatus, 'itemType:', item.type)
                                if (confirm(`배송 완료로 바로 처리하시겠습니까?\n(orderId: ${orderId})`)) {
                                  await updateOrderStatus(orderId, 'delivered', itemKey)
                                }
                              }}
                                disabled={processing === itemKey}
                                className="w-full border border-green-300 text-green-700 py-2.5 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                                바로 배송 완료 처리
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
                                  <button onClick={() => { const total = item.type === 'quote' ? ((d as Quote).total_amount || 0) : (d as DirectOrder).total_amount; const pm = item.type === 'quote' ? (d as Quote).order?.payment_method : (d as DirectOrder).payment_method; openCancelModal(orderId, itemKey, total, pm === 'CARD' || pm === 'card') }}
                                    disabled={processing === itemKey}
                                    className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                                    환불 처리
                                  </button>
                                  <button onClick={async () => { if (confirm('환불 요청을 거절하시겠습니까?')) await updateOrderStatus(orderId, 'paid', itemKey) }}
                                    disabled={processing === itemKey}
                                    className="flex-1 border border-gray-300 bg-white text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                                    거절
                                  </button>
                                </div>
                              </div>
                            )}

                            {(orderStatus === 'paid' || orderStatus === 'in_progress' || orderStatus === 'shipped') && (
                              <button onClick={() => { const total = item.type === 'quote' ? ((d as Quote).total_amount || 0) : (d as DirectOrder).total_amount; const pm = item.type === 'quote' ? (d as Quote).order?.payment_method : (d as DirectOrder).payment_method; openCancelModal(orderId, itemKey, total, pm === 'CARD' || pm === 'card') }}
                                disabled={processing === itemKey}
                                className="w-full border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                                결제 취소 / 환불
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* 진행 관리 메모 */}
                      {(() => {
                        const memoKey = `${item.type}-${d.id}`
                        const existingMemo = item.type === 'quote' ? (d as Quote).admin_note : (d as DirectOrder).memo
                        const memoLines = existingMemo ? existingMemo.split('\n').filter(Boolean) : []
                        return (
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">진행 관리 내역</p>
                            {memoLines.length > 0 ? (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {memoLines.map((line, i) => {
                                  const match = line.match(/^\[(.+?)\] (.+)$/)
                                  return match ? (
                                    <div key={i} className="flex gap-2 text-xs">
                                      <span className="text-gray-400 shrink-0">{match[1]}</span>
                                      <span className="text-gray-700">{match[2]}</span>
                                    </div>
                                  ) : (
                                    <div key={i} className="text-xs text-gray-600">{line}</div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">기록된 내역이 없습니다.</p>
                            )}
                            <div className="flex gap-2 pt-1 border-t border-gray-200">
                              <input
                                type="text"
                                value={memoInputs[memoKey] || ''}
                                onChange={(e) => setMemoInputs((p) => ({ ...p, [memoKey]: e.target.value }))}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    const memo = memoInputs[memoKey]?.trim()
                                    if (!memo) return
                                    setMemoSaving(memoKey)
                                    const res = await fetch('/api/admin/save-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: item.type, id: d.id, memo, existing: existingMemo }) })
                                    if (res.ok) { setMemoInputs((p) => ({ ...p, [memoKey]: '' })); await loadAll() }
                                    setMemoSaving(null)
                                  }
                                }}
                                placeholder="내역 입력 후 Enter"
                                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                              />
                              <button
                                onClick={async () => {
                                  const memo = memoInputs[memoKey]?.trim()
                                  if (!memo) return
                                  setMemoSaving(memoKey)
                                  const res = await fetch('/api/admin/save-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: item.type, id: d.id, memo, existing: existingMemo }) })
                                  if (res.ok) { setMemoInputs((p) => ({ ...p, [memoKey]: '' })); await loadAll() }
                                  setMemoSaving(null)
                                }}
                                disabled={memoSaving === memoKey || !memoInputs[memoKey]?.trim()}
                                className="shrink-0 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-40"
                              >
                                {memoSaving === memoKey ? '...' : '저장'}
                              </button>
                            </div>
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

        {/* 페이지 넘버링 */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40">이전</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
              .map((n, idx, arr) => (
                <span key={n} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-gray-300">…</span>}
                  <button onClick={() => setPage(n)}
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

      {/* 작업 시작 — 장비 지정 모달 */}
      {machineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">작업 장비 지정</h2>
              <button onClick={() => setMachineModal(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>

            <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${machineModal.requested ? 'bg-violet-50 text-violet-700' : 'bg-gray-50 text-gray-600'}`}>
              {machineModal.requested
                ? <>고객 요청 장비: <b>{machineModal.requested}번</b></>
                : <>고객이 <b>자동 배정</b>을 선택했습니다. 작업할 장비를 지정해주세요.</>}
            </div>

            <label className="text-xs font-semibold text-gray-600 block mb-2">실제 작업 장비 <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {Array.from({ length: MACHINE_COUNT }, (_, i) => i + 1).map((n) => {
                const disabled = n > ACTIVE_MACHINE_COUNT
                return (
                  <button key={n} disabled={disabled} onClick={() => setMachineModal({ ...machineModal, value: n })}
                    title={disabled ? '2027년 오픈 예정' : undefined}
                    className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${disabled ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed' : machineModal.value === n ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-300'}`}>
                    {n}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setMachineModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={confirmStartWork} disabled={processing === machineModal.itemKey}
                className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                {processing === machineModal.itemKey ? '처리 중...' : '작업 시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 처리 바 */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 text-white shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">
              <b className="text-base">{selected.size}</b>건 선택됨
              <button onClick={() => setSelected(new Set())} className="ml-3 text-white/50 hover:text-white text-xs underline">선택 해제</button>
            </div>
            <button onClick={advanceSelected} disabled={bulkRunning}
              className="flex items-center gap-1.5 bg-violet-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50">
              {bulkRunning ? '처리 중...' : '다음 단계로 일괄 처리 →'}
            </button>
          </div>
        </div>
      )}

      {/* 취소/환불 모달 */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">결제 취소 / 환불</h2>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${cancelModal.isCard ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
              {cancelModal.isCard
                ? '💳 카드 결제 — 토스페이먼츠에서 자동으로 취소(환불)됩니다.'
                : '🏦 무통장입금 — 자동 환불이 불가하여 환불 계좌를 기록합니다. 실제 송금은 직접 진행하세요.'}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  취소 금액 <span className="text-gray-400 font-normal">(전액: {cancelModal.total.toLocaleString()}원)</span>
                </label>
                <input type="number" value={cancelAmount} onChange={(e) => { setCancelAmount(e.target.value); setCancelError('') }} max={cancelModal.total} min={1}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300" />
                <p className="text-xs text-gray-400 mt-1">전액보다 적게 입력하면 부분취소됩니다.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">취소 사유 <span className="text-red-500">*</span></label>
                <input type="text" value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelError('') }} placeholder="예) 고객 단순 변심, 재고 부족"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>

              {!cancelModal.isCard && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">환불 계좌 <span className="text-gray-400 font-normal">(선택)</span></label>
                  <input type="text" value={refundAccount} onChange={(e) => setRefundAccount(e.target.value)} placeholder="예) 기업은행 123-456-789 홍길동"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              )}

              {cancelError && <p className="text-red-500 text-sm">{cancelError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setCancelModal(null)} disabled={cancelLoading}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                  닫기
                </button>
                <button onClick={submitCancel} disabled={cancelLoading}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                  {cancelLoading ? '처리 중...' : (cancelModal.isCard ? '토스 취소 실행' : '환불 처리 기록')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminManagePage() {
  return <Suspense><AdminManagePageContent /></Suspense>
}
