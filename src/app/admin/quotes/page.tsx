'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, CheckCircle, Clock, CreditCard, XCircle, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  A4: 'A4 출력',
  A3: 'A3 출력',
  roll_58: '58cm 롤 출력',
  other: '기타',
}

const STATUS_CONFIG = {
  pending: { label: '검토 대기중', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  quoted: { label: '견적 발송완료', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  paid: { label: '결제 완료', color: 'bg-green-100 text-green-700', icon: CreditCard },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-600', icon: XCircle },
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
}

interface QuoteForm {
  quantity: string
  unit: string
  unitPrice: string
  cutting: boolean
  cuttingPrice: string
  adminNote: string
}

const TABS = ['pending', 'quoted', 'paid', 'cancelled'] as const

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<typeof TABS[number]>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, QuoteForm>>({})
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => { loadQuotes() }, [])

  const loadQuotes = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  const getForm = (id: string): QuoteForm =>
    forms[id] || { quantity: '', unit: 'M', unitPrice: '', cutting: false, cuttingPrice: '', adminNote: '' }

  const setForm = (id: string, patch: Partial<QuoteForm>) =>
    setForms((p) => ({ ...p, [id]: { ...getForm(id), ...patch } }))

  const calcTotal = (form: QuoteForm): number => {
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
    await supabase.from('quotes').update({
      status: 'quoted',
      quoted_quantity: parseFloat(form.quantity),
      quoted_unit: form.unit,
      unit_price: parseInt(form.unitPrice),
      cutting: form.cutting,
      cutting_price: form.cutting ? (parseInt(form.cuttingPrice) || 0) : 0,
      total_amount: calcTotal(form),
      admin_note: form.adminNote || null,
      quoted_at: new Date().toISOString(),
    }).eq('id', quote.id)
    await loadQuotes()
    setSending(null)
  }

  const cancelQuote = async (id: string) => {
    if (!confirm('이 견적을 취소하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'cancelled' }).eq('id', id)
    await loadQuotes()
  }

  const downloadFile = async (filePath: string, fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage.from('order-files').createSignedUrl(filePath, 60)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = fileName
      a.click()
    }
  }

  const tabCounts = TABS.reduce((acc, t) => ({ ...acc, [t]: quotes.filter((q) => q.status === t).length }), {} as Record<string, number>)
  const displayQuotes = quotes.filter((q) => q.status === tab)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">견적 관리</h1>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((t) => {
          const cfg = STATUS_CONFIG[t]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold transition-colors relative ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {cfg.label}
              {tabCounts[t] > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${t === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tabCounts[t]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : displayQuotes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{STATUS_CONFIG[tab].label} 견적이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {displayQuotes.map((quote) => {
            const isExpanded = expanded === quote.id
            const cfg = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]
            const StatusIcon = cfg.icon
            const form = getForm(quote.id)
            const total = calcTotal(form)

            return (
              <div key={quote.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                {/* 요약 헤더 */}
                <div
                  className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : quote.id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{quote.user_name || quote.user_email}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span>{PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type}</span>
                        <span>·</span>
                        <span>{new Date(quote.created_at).toLocaleDateString('ko-KR')}</span>
                        {quote.total_amount && <><span>·</span><span className="text-blue-600 font-semibold">{quote.total_amount.toLocaleString()}원</span></>}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-6 space-y-5">
                    {/* 고객 정보 */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">고객 정보</p>
                        <div className="space-y-1">
                          <div className="flex gap-2"><span className="text-gray-400 w-14">이름</span><span className="text-gray-800">{quote.user_name || '—'}</span></div>
                          <div className="flex gap-2"><span className="text-gray-400 w-14">연락처</span><span className="text-gray-800">{quote.user_phone || '—'}</span></div>
                          <div className="flex gap-2"><span className="text-gray-400 w-14">이메일</span><span className="text-gray-800 break-all">{quote.user_email || '—'}</span></div>
                          <div className="flex gap-2"><span className="text-gray-400 w-14">주소</span><span className="text-gray-800">{quote.user_address || '—'}</span></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">요청 내용</p>
                        <div className="space-y-1">
                          <div className="flex gap-2"><span className="text-gray-400 w-14">상품</span><span className="text-gray-800">{PRODUCT_TYPE_LABEL[quote.product_type]}</span></div>
                          {quote.request_note && <div className="flex gap-2"><span className="text-gray-400 w-14">요구사항</span><span className="text-gray-800">{quote.request_note}</span></div>}
                        </div>
                      </div>
                    </div>

                    {/* 파일 다운로드 */}
                    {quote.file_url && quote.file_name && (
                      <button
                        onClick={() => downloadFile(quote.file_url!, quote.file_name!)}
                        className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        시안 파일 다운로드: {quote.file_name}
                      </button>
                    )}

                    {/* 견적 입력 폼 - pending일 때만 */}
                    {quote.status === 'pending' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                        <p className="text-sm font-bold text-gray-700">견적 작성</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">출력 수량 *</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={form.quantity}
                                onChange={(e) => setForm(quote.id, { quantity: e.target.value })}
                                placeholder="예) 3"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <select
                                value={form.unit}
                                onChange={(e) => setForm(quote.id, { unit: e.target.value })}
                                className="border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                <option value="M">M</option>
                                <option value="장">장</option>
                                <option value="개">개</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 block mb-1">단가 (원) *</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={form.unitPrice}
                              onChange={(e) => setForm(quote.id, { unitPrice: e.target.value })}
                              placeholder="예) 8900"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                        </div>

                        {/* 컷팅 */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.cutting}
                              onChange={(e) => setForm(quote.id, { cutting: e.target.checked })}
                              className="w-4 h-4 accent-blue-600"
                            />
                            <span className="text-sm font-medium text-gray-700">컷팅 포함</span>
                          </label>
                          {form.cutting && (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={form.cuttingPrice}
                              onChange={(e) => setForm(quote.id, { cuttingPrice: e.target.value })}
                              placeholder="컷팅 금액"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          )}
                        </div>

                        {/* 메모 */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">고객 메모 (선택)</label>
                          <input
                            type="text"
                            value={form.adminNote}
                            onChange={(e) => setForm(quote.id, { adminNote: e.target.value })}
                            placeholder="고객에게 전달할 내용 (예: 배경 제거 후 출력, 색상 주의)"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>

                        {/* 합계 미리보기 */}
                        {total > 0 && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                            <span className="text-sm text-gray-600">견적 금액 (VAT 포함)</span>
                            <span className="font-bold text-blue-600 text-lg">{total.toLocaleString()}원</span>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => cancelQuote(quote.id)}
                            className="flex-1 border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                          >
                            견적 거절
                          </button>
                          <button
                            onClick={() => sendQuote(quote)}
                            disabled={sending === quote.id || !form.quantity || !form.unitPrice}
                            className="flex-2 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            {sending === quote.id ? '발송 중...' : '견적 발송'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 발송된 견적 내용 표시 */}
                    {(quote.status === 'quoted' || quote.status === 'paid') && quote.total_amount && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-3">발송된 견적</p>
                        <div className="space-y-1.5">
                          {quote.quoted_quantity && <div className="flex gap-2"><span className="text-gray-500 w-20">출력 수량</span><span className="font-semibold text-gray-800">{quote.quoted_quantity}{quote.quoted_unit}</span></div>}
                          {quote.unit_price && <div className="flex gap-2"><span className="text-gray-500 w-20">단가</span><span className="text-gray-800">{quote.unit_price.toLocaleString()}원</span></div>}
                          {quote.cutting && <div className="flex gap-2"><span className="text-gray-500 w-20">컷팅</span><span className="text-gray-800">+{quote.cutting_price.toLocaleString()}원</span></div>}
                          <div className="flex gap-2 pt-2 border-t border-blue-200"><span className="text-gray-500 w-20">최종 금액</span><span className="font-bold text-blue-600">{quote.total_amount.toLocaleString()}원</span></div>
                          {quote.admin_note && <div className="flex gap-2"><span className="text-gray-500 w-20">메모</span><span className="text-gray-700">{quote.admin_note}</span></div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
