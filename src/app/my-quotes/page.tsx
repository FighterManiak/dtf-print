'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ChevronDown, ChevronUp, Clock, CheckCircle, CreditCard, XCircle, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

const TOSS_CLIENT_KEY = 'test_ck_jZ61JOxRQVEoxknP6KD8W0X9bAqw'

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  A4: 'A4 출력',
  A3: 'A3 출력',
  roll_58: '58cm 롤 출력',
  other: '기타',
}

const STATUS_CONFIG = {
  pending: { label: '검토 대기중', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  quoted: { label: '견적 완료', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  paid: { label: '결제 완료', color: 'bg-green-100 text-green-700', icon: CreditCard },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-600', icon: XCircle },
}

interface Quote {
  id: string
  created_at: string
  status: string
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
  quoted_at: string | null
}

export default function MyQuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser({ id: user.id, email: user.email || '' })
      await loadQuotes(user.id)
    }
    init()
  }, [])

  const loadQuotes = async (uid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
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
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  const cancelQuote = async (quoteId: string) => {
    if (!confirm('견적 요청을 취소하시겠습니까?')) return
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'cancelled' }).eq('id', quoteId)
    setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: 'cancelled' } : q))
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">견적 현황</h1>
        <button
          onClick={() => router.push('/quote/request')}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          + 새 견적 요청
        </button>
      </div>
      {user && <p className="text-sm text-gray-400 mb-6">{user.email}</p>}

      {quotes.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-6">아직 견적 요청 내역이 없습니다.</p>
          <button
            onClick={() => router.push('/quote/request')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            첫 견적 요청하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map((quote) => {
            const isExpanded = expanded === quote.id
            const cfg = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
            const StatusIcon = cfg.icon
            return (
              <div key={quote.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* 요약 */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : quote.id)}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">{PRODUCT_TYPE_LABEL[quote.product_type] || quote.product_type}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(quote.created_at).toLocaleDateString('ko-KR')}</span>
                      {quote.total_amount && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-blue-600">{quote.total_amount.toLocaleString()}원</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {/* 상세 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    {/* 요청 정보 */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">요청 내용</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex gap-2"><span className="text-gray-400 w-20">상품 유형</span><span className="text-gray-800">{PRODUCT_TYPE_LABEL[quote.product_type]}</span></div>
                        {(() => {
                          const files = parseFiles(quote.file_url, quote.file_name)
                          return files.length > 0 ? (
                            <div className="flex gap-2">
                              <span className="text-gray-400 w-20 shrink-0">시안 파일</span>
                              <div className="flex flex-col gap-1.5">
                                {files.map((f, i) => (
                                  <button
                                    key={i}
                                    onClick={() => downloadFile(f.url, f.name)}
                                    className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    {f.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null
                        })()}
                        {quote.request_note && <div className="flex gap-2"><span className="text-gray-400 w-20">요구사항</span><span className="text-gray-800">{quote.request_note}</span></div>}
                      </div>
                    </div>

                    {/* 견적 내용 - quoted 이상일 때 */}
                    {(quote.status === 'quoted' || quote.status === 'paid') && quote.total_amount && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-3">확정 견적</p>
                        <div className="space-y-1.5 text-sm">
                          {quote.quoted_quantity && <div className="flex gap-2"><span className="text-gray-500 w-20">출력 수량</span><span className="font-semibold text-gray-800">{quote.quoted_quantity}{quote.quoted_unit}</span></div>}
                          {quote.unit_price && <div className="flex gap-2"><span className="text-gray-500 w-20">단가</span><span className="text-gray-800">{quote.unit_price.toLocaleString()}원</span></div>}
                          {quote.cutting && <div className="flex gap-2"><span className="text-gray-500 w-20">컷팅</span><span className="text-gray-800">있음 (+{quote.cutting_price.toLocaleString()}원)</span></div>}
                          <div className="flex gap-2 pt-2 border-t border-blue-200 mt-2">
                            <span className="text-gray-500 w-20">최종 금액</span>
                            <span className="font-bold text-blue-600 text-base">{quote.total_amount.toLocaleString()}원</span>
                            <span className="text-xs text-gray-400 self-end">(VAT 포함)</span>
                          </div>
                          {quote.admin_note && (
                            <div className="flex gap-2 pt-2">
                              <span className="text-gray-500 w-20">담당자 메모</span>
                              <span className="text-gray-700">{quote.admin_note}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 대기중 안내 */}
                    {quote.status === 'pending' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                        시안 파일 검토 중입니다. 영업일 기준 1~2시간 내에 견적을 보내드립니다.
                      </div>
                    )}

                    {/* 결제 버튼 */}
                    {quote.status === 'quoted' && (
                      <button
                        onClick={() => handlePay(quote)}
                        disabled={paying === quote.id}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                      >
                        {paying === quote.id ? '결제창 열는 중...' : `${quote.total_amount?.toLocaleString()}원 결제하기`}
                      </button>
                    )}

                    {/* 취소 버튼 */}
                    {quote.status === 'pending' && (
                      <button
                        onClick={() => cancelQuote(quote.id)}
                        className="w-full border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        견적 요청 취소
                      </button>
                    )}

                    {quote.status === 'paid' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-medium">
                        ✓ 결제가 완료되었습니다. 작업을 진행 중입니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 text-center pt-2">총 {quotes.length}건</p>
        </div>
      )}
    </div>
  )
}
