'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload, X, CheckCircle, Scissors, Plus, Minus, Calendar, FileText, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { PRODUCTS, VERIFIED_PRODUCTS, type ProductId } from '@/types'

const TOSS_CLIENT_KEY = 'test_ck_jZ61JOxRQVEoxknP6KD8W0X9bAqw'

const PRODUCT_TYPES = [
  { id: 'A4',     label: 'A4 출력',     desc: '210×297mm 단품 출력' },
  { id: 'A3',     label: 'A3 출력',     desc: '297×420mm 단품 출력' },
  { id: 'roll_58',label: '58cm 롤 출력',desc: '58cm 폭 롤 단위 출력 (길이 미정)' },
  { id: 'other',  label: '기타',        desc: '직접 요구사항 입력' },
]

const ROLL_PRODUCTS: ProductId[] = ['roll_58_1m', 'roll_58_50m', 'roll_58_100m']
const CUTTING_PRICE_PER_M = 1000

const formatPhone = (v: string) => {
  const n = v.replace(/[^0-9]/g, '')
  if (n.length <= 3) return n
  if (n.length <= 7) return `${n.slice(0,3)}-${n.slice(3)}`
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7,11)}`
}

interface CartItem {
  productId: ProductId; quantity: number; cutting: boolean
  cuttingPrice: string; file: File | null; requestNote: string; dueDate: string
}
interface CustomerInfo { name: string; email: string; phone: string; address: string }

function OrderPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 모드: null = 선택 전, 'quote' = 견적, 'direct' = 바로주문
  const [mode, setMode] = useState<'quote' | 'direct' | null>(null)
  const [step, setStep] = useState<1|2|3>(1)

  // 공통
  const [orderName, setOrderName] = useState('')
  const [customer, setCustomer] = useState<CustomerInfo>({ name:'', email:'', phone:'', address:'' })
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({})

  // 견적 모드 전용
  const [productType, setProductType] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [requestNote, setRequestNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 바로주문 모드 전용
  const [cart, setCart] = useState<CartItem[]>([])
  const [expandedProduct, setExpandedProduct] = useState<ProductId | null>(null)
  const [payMethod, setPayMethod] = useState<'card'|'bank'>('card')
  const [bankDone, setBankDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const ALL_PRODUCTS = [...PRODUCTS, ...VERIFIED_PRODUCTS]

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setCustomer({
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
        phone: formatPhone(user.user_metadata?.phone || ''),
        address: user.user_metadata?.address || '',
      })
    }
    load()
    // URL 파라미터로 모드 자동 선택
    const m = searchParams.get('mode')
    if (m === 'quote' || m === 'direct') setMode(m)
  }, [])

  // ── 공통 헬퍼 ──
  const validateCustomer = () => {
    const e: Partial<CustomerInfo> = {}
    if (!customer.name.trim()) e.name = '이름을 입력해주세요'
    if (!customer.email.trim() || !/\S+@\S+\.\S+/.test(customer.email)) e.email = '올바른 이메일을 입력해주세요'
    if (!customer.phone.trim()) e.phone = '연락처를 입력해주세요'
    if (!customer.address.trim()) e.address = '배송지를 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── 견적 제출 ──
  const handleQuoteSubmit = async () => {
    if (!userId) return
    setUploading(true)
    const supabase = createClient()
    const uploadedUrls: string[] = []
    const uploadedNames: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `${userId}/quotes/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
      const { error } = await supabase.storage.from('order-files').upload(path, file)
      if (error) { setUploading(false); alert(`파일 업로드 실패: ${error.message}`); return }
      uploadedUrls.push(path)
      uploadedNames.push(file.name)
    }
    await supabase.from('quotes').insert({
      user_id: userId, user_name: customer.name, user_email: customer.email,
      user_phone: customer.phone, user_address: customer.address,
      product_type: productType, order_name: orderName.trim() || null,
      request_note: requestNote,
      file_url: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null,
      file_name: uploadedNames.length > 0 ? JSON.stringify(uploadedNames) : null,
      status: 'pending',
    })
    setUploading(false)
    setSubmitted(true)
  }

  // ── 바로주문 결제 ──
  const totalAmount = cart.reduce((sum, item) => {
    const p = ALL_PRODUCTS.find((x) => x.id === item.productId)!
    const cut = item.cutting ? (ROLL_PRODUCTS.includes(item.productId) ? item.quantity * CUTTING_PRICE_PER_M : (parseInt(item.cuttingPrice)||0)) : 0
    return sum + p.price * item.quantity + cut
  }, 0)

  const handlePayment = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 결제 전 DB에 order 생성 (pending) → 성공 시 paid로 업데이트
      const displayName = orderName.trim() || (cart.length === 1 ? ALL_PRODUCTS.find(p=>p.id===cart[0].productId)?.name || cart[0].productId : `${ALL_PRODUCTS.find(p=>p.id===cart[0].productId)?.name || cart[0].productId} 외 ${cart.length-1}개`)
      const res = await fetch('/api/order/bank-transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderName: displayName, customer,
          cart: cart.map((item) => {
            const p = ALL_PRODUCTS.find((x) => x.id === item.productId)!
            const cutAmt = item.cutting ? (ROLL_PRODUCTS.includes(item.productId) ? item.quantity*CUTTING_PRICE_PER_M : (parseInt(item.cuttingPrice)||0)) : 0
            return { productId: item.productId, productName: p.name, quantity: item.quantity, unitPrice: p.price, cutting: item.cutting, cuttingPrice: cutAmt, requestNote: item.requestNote, dueDate: item.dueDate||null }
          }),
          totalAmount, paymentMethod: 'CARD',
        }),
      })
      const { orderId: dbOrderId } = await res.json()

      const toss = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = toss.payment({ customerKey: user?.id || 'GUEST' })
      await payment.requestPayment({
        method: 'CARD', amount: { currency: 'KRW', value: totalAmount },
        orderId: dbOrderId || `ORDER-${Date.now()}`,
        orderName: displayName,
        customerName: customer.name, customerEmail: customer.email,
        customerMobilePhone: customer.phone.replace(/-/g, ''),
        successUrl: `${window.location.origin}/payment/success?dbOrderId=${dbOrderId}`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'PAYMENT_CANCELED') alert('결제 오류: ' + err.message)
    }
  }

  const handleBankTransfer = async () => {
    setSubmitting(true)
    const res = await fetch('/api/order/bank-transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderName: orderName.trim() || null, customer,
        cart: cart.map((item) => {
          const p = ALL_PRODUCTS.find((x) => x.id === item.productId)!
          const cutAmt = item.cutting ? (ROLL_PRODUCTS.includes(item.productId) ? item.quantity*CUTTING_PRICE_PER_M : (parseInt(item.cuttingPrice)||0)) : 0
          return { productId: item.productId, productName: p.name, quantity: item.quantity, unitPrice: p.price, cutting: item.cutting, cuttingPrice: cutAmt, requestNote: item.requestNote, dueDate: item.dueDate||null }
        }),
        totalAmount,
      }),
    })
    if (res.ok) setBankDone(true)
    else alert('처리 중 오류가 발생했습니다.')
    setSubmitting(false)
  }

  // ── 스텝 인디케이터 ──
  const quoteSteps = ['상품 유형', '시안 파일', '배송 정보']
  const directSteps = ['상품 선택', '배송 정보', '결제 확인']
  const stepLabels = mode === 'quote' ? quoteSteps : directSteps

  const StepIndicator = () => (
    <div className="flex items-center mb-8">
      {stepLabels.map((label, idx) => {
        const n = (idx+1) as 1|2|3
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step>n ? 'bg-blue-600 text-white' : step===n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {step>n ? '✓' : n}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${step>=n ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {idx < stepLabels.length-1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${step>n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )

  // ── 완료 화면 ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">견적 요청 완료!</h2>
          <p className="text-gray-500 mb-2">시안 파일 검토 후 빠르게 견적을 보내드리겠습니다.</p>
          <p className="text-sm text-gray-400 mb-8">평균 견적 발송 시간: 영업일 기준 1~2시간</p>
          <div className="flex gap-3">
            <button onClick={() => router.push('/my-quotes')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">주문 현황 확인</button>
            <button onClick={() => router.push('/')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">홈으로</button>
          </div>
        </div>
      </div>
    )
  }

  if (bankDone) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6 z-50">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-5">
          <span className="text-3xl">🏦</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">입금 접수 완료!</h2>
        <p className="text-gray-500 text-center mb-8">관리자가 입금 확인 후 작업을 시작합니다.</p>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 w-full max-w-sm text-sm space-y-1.5 mb-8">
          <div className="flex justify-between"><span className="text-gray-500">은행</span><span className="font-semibold">기업은행</span></div>
          <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-bold tracking-wider">495-028223-01-021</span></div>
          <div className="flex justify-between"><span className="text-gray-500">예금주</span><span className="font-semibold">아유디스터디 (조봉준)</span></div>
          <div className="flex justify-between border-t border-orange-200 pt-2 mt-1">
            <span className="text-gray-500">입금 금액</span>
            <span className="font-bold text-orange-700 text-base">{totalAmount.toLocaleString()}원</span>
          </div>
        </div>
        <button onClick={() => router.push('/my-quotes')} className="w-full max-w-sm bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-700 transition-colors">
          내 주문 현황 확인
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* ── 모드 선택 ── */}
        {!mode && (
          <div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">주문 방식 선택</h1>
              <p className="text-gray-500">원하시는 주문 방식을 선택해주세요.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 견적 받기 */}
              <button
                onClick={() => { setMode('quote'); setStep(1) }}
                className="group text-left bg-white border-2 border-gray-200 rounded-3xl p-8 hover:border-blue-500 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors">
                  <FileText className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">견적 받기</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  시안 파일을 업로드하면<br />
                  출력 수량 확인 후 견적을 보내드립니다.
                </p>
                <div className="space-y-1.5">
                  {['시안 파일 업로드', '관리자가 수량/가격 확정', '견적 확인 후 결제'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold shrink-0">{i+1}</span>
                      {t}
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <span className="text-xs text-blue-600 font-semibold">처음 주문하시거나 수량이 미정인 경우 추천</span>
                </div>
              </button>

              {/* 바로 주문 */}
              <button
                onClick={() => { setMode('direct'); setStep(1) }}
                className="group text-left bg-white border-2 border-gray-200 rounded-3xl p-8 hover:border-violet-500 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-violet-600 transition-colors">
                  <Zap className="w-7 h-7 text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">바로 주문</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  미터수 / 수량을 직접 입력하고<br />
                  바로 결제까지 진행합니다.
                </p>
                <div className="space-y-1.5">
                  {['상품 및 수량 직접 입력', '배송 정보 입력', '카드 / 무통장 결제'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold shrink-0">{i+1}</span>
                      {t}
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <span className="text-xs text-violet-600 font-semibold">장비 보유 고객 또는 재주문 시 추천</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── 견적 플로우 ── */}
        {mode === 'quote' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => { setMode(null); setStep(1) }} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← 처음으로</button>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-semibold text-blue-600">견적 받기</span>
            </div>
            <StepIndicator />

            {/* QUOTE STEP 1: 상품 유형 */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">어떤 상품을 원하시나요?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {PRODUCT_TYPES.map((p) => (
                    <button key={p.id} onClick={() => setProductType(p.id)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all ${productType===p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                      <div className={`font-bold mb-1 ${productType===p.id ? 'text-blue-700' : 'text-gray-800'}`}>{p.label}</div>
                      <div className="text-sm text-gray-500">{p.desc}</div>
                    </button>
                  ))}
                </div>
                {productType && (
                  <div className="mb-6">
                    <label className="text-sm font-semibold text-gray-700 block mb-2">주문명 <span className="text-gray-400 font-normal">(선택)</span></label>
                    <input type="text" value={orderName} onChange={(e) => setOrderName(e.target.value)} placeholder="예) 여름 신상 로고, 브랜드 패치 200장" maxLength={50}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400" />
                  </div>
                )}
                <button disabled={!productType} onClick={() => setStep(2)}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-40">
                  다음 →
                </button>
              </div>
            )}

            {/* QUOTE STEP 2: 파일 업로드 */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">시안 파일 업로드</h2>
                <div className="space-y-3 mb-6">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                      <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {f.name.split('.').pop()?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate">{f.name}</div>
                        <div className="text-xs text-gray-500">{(f.size/1024/1024).toFixed(1)}MB</div>
                      </div>
                      <button onClick={() => setFiles((p) => p.filter((_,idx) => idx!==i))} className="text-gray-400 hover:text-red-500 p-1">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {files.length < 10 && (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-white hover:border-blue-400 hover:bg-blue-50 transition-all">
                      <Upload className="w-7 h-7 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600 font-medium">{files.length===0 ? '파일을 선택하거나 드래그하세요' : '파일 추가'}</span>
                      <span className="text-xs text-gray-400 mt-1">PNG, JPG, AI, PDF, PSD · 최대 10개 ({files.length}/10)</span>
                      <input type="file" className="hidden" accept="image/*,.pdf,.ai,.psd,.eps" multiple onChange={(e) => { const sel=Array.from(e.target.files||[]); setFiles((p) => [...p,...sel].slice(0,10)); e.target.value='' }} />
                    </label>
                  )}
                </div>
                <div className="mb-8">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">요구사항 / 참고사항</label>
                  <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="색상, 배경 제거, 예상 수량 등 자유롭게 입력하세요." rows={4}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder:text-gray-400" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50">← 이전</button>
                  <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700">다음 →</button>
                </div>
              </div>
            )}

            {/* QUOTE STEP 3: 배송 정보 */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">배송 정보 확인</h2>
                <p className="text-sm text-gray-500 mb-5">기본 정보가 자동 입력됩니다. 필요시 수정하세요.</p>
                <div className="space-y-4 mb-5">
                  {[{label:'이름',key:'name',type:'text',ph:'홍길동'},{label:'이메일',key:'email',type:'email',ph:'example@email.com'},{label:'연락처',key:'phone',type:'tel',ph:'010-0000-0000'},{label:'배송지 주소',key:'address',type:'text',ph:'배송받으실 주소'}].map(({label,key,type,ph}) => (
                    <div key={key}>
                      <label className="text-sm font-semibold text-gray-700 block mb-1.5">{label}</label>
                      <input type={type} value={customer[key as keyof CustomerInfo]} onChange={(e) => setCustomer((p) => ({...p,[key]:e.target.value}))} placeholder={ph}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400" />
                    </div>
                  ))}
                </div>
                {/* 요약 */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm space-y-2">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-2">견적 요청 요약</p>
                  {orderName && <div className="flex gap-2"><span className="text-gray-500 w-16 shrink-0">주문명</span><span className="text-gray-800 font-semibold">{orderName}</span></div>}
                  <div className="flex gap-2"><span className="text-gray-500 w-16 shrink-0">상품 유형</span><span className="text-gray-800 font-semibold">{PRODUCT_TYPES.find(p=>p.id===productType)?.label}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16 shrink-0">시안 파일</span><span className="text-gray-800">{files.length>0 ? `${files.length}개 선택됨` : '없음'}</span></div>
                  {requestNote && <div className="flex gap-2"><span className="text-gray-500 w-16 shrink-0">요구사항</span><span className="text-gray-700 break-all">{requestNote}</span></div>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50">← 이전</button>
                  <button onClick={handleQuoteSubmit} disabled={uploading||!customer.name||!customer.phone}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-40">
                    {uploading ? '제출 중...' : '견적 요청하기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 바로주문 플로우 ── */}
        {mode === 'direct' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => { setMode(null); setStep(1) }} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← 처음으로</button>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-semibold text-violet-600">바로 주문</span>
            </div>
            <StepIndicator />

            {/* DIRECT STEP 1: 상품 선택 */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">상품 선택 및 수량 입력</h2>
                <div className="space-y-3 mb-6">
                  {PRODUCTS.map((product) => {
                    const inCart = cart.find((i) => i.productId===product.id)
                    const isExpanded = expandedProduct===product.id
                    return (
                      <div key={product.id} className={`border rounded-2xl overflow-hidden transition-all ${inCart ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <div className="font-bold text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.description}</div>
                            <div className="text-violet-600 font-bold mt-1">{product.price.toLocaleString()}원 / {product.unit}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {inCart ? (
                              <>
                                <button onClick={() => setExpandedProduct(isExpanded?null:product.id)} className="text-violet-600 hover:bg-violet-100 p-2 rounded-lg">
                                  {isExpanded ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                </button>
                                <button onClick={() => setCart((p) => p.filter((i) => i.productId!==product.id))} className="text-red-400 hover:bg-red-50 p-2 rounded-lg">
                                  <X className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => { setCart((p) => [...p,{productId:product.id,quantity:1,cutting:false,cuttingPrice:'',file:null,requestNote:'',dueDate:''}]); setExpandedProduct(product.id) }}
                                className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">
                                선택
                              </button>
                            )}
                          </div>
                        </div>
                        {inCart && isExpanded && (
                          <div className="border-t border-violet-200 p-4 bg-white space-y-4">
                            {/* 수량 */}
                            <div>
                              <label className="text-sm font-semibold text-gray-700 block mb-2">수량</label>
                              <div className="flex items-center gap-3">
                                <button onClick={() => setCart((p) => p.map((i) => i.productId===product.id ? {...i,quantity:Math.max(1,i.quantity-1)} : i))}
                                  className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50">
                                  <Minus className="w-4 h-4 text-gray-700" />
                                </button>
                                <input type="text" inputMode="numeric" value={inCart.quantity}
                                  onChange={(e) => { const v=parseInt(e.target.value.replace(/[^0-9]/g,'')); setCart((p) => p.map((i) => i.productId===product.id ? {...i,quantity:isNaN(v)||v<1?1:v} : i)) }}
                                  className="w-16 text-center font-bold text-lg text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 py-1" />
                                <button onClick={() => setCart((p) => p.map((i) => i.productId===product.id ? {...i,quantity:i.quantity+1} : i))}
                                  className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50">
                                  <Plus className="w-4 h-4 text-gray-700" />
                                </button>
                                <span className="text-gray-500 text-sm">{product.unit}</span>
                              </div>
                            </div>
                            {/* 컷팅 */}
                            <div>
                              <label className="text-sm font-semibold text-gray-700 block mb-2"><Scissors className="w-4 h-4 inline mr-1" />컷팅 옵션</label>
                              <div className="flex gap-3">
                                {[{v:false,l:'컷팅 없음'},{v:true,l:'컷팅 있음'}].map(({v,l}) => (
                                  <button key={String(v)} onClick={() => setCart((p) => p.map((i) => i.productId===product.id ? {...i,cutting:v} : i))}
                                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${inCart.cutting===v ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-300 text-gray-600 hover:border-violet-300'}`}>
                                    {l}
                                  </button>
                                ))}
                              </div>
                              {inCart.cutting && (
                                <div className="mt-2">
                                  {ROLL_PRODUCTS.includes(product.id) ? (
                                    <div className="flex items-center gap-2 p-2.5 bg-violet-50 rounded-xl text-xs text-violet-700">
                                      컷팅 요금: 1M당 {CUTTING_PRICE_PER_M.toLocaleString()}원 × {inCart.quantity}M =
                                      <span className="font-bold">{(inCart.quantity*CUTTING_PRICE_PER_M).toLocaleString()}원</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <input type="number" min="0" value={inCart.cuttingPrice}
                                        onChange={(e) => setCart((p) => p.map((i) => i.productId===product.id ? {...i,cuttingPrice:e.target.value} : i))}
                                        placeholder="컷팅 금액 입력"
                                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                      <span className="text-sm text-gray-500">원</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* 시안 파일 */}
                            <div>
                              <label className="text-sm font-semibold text-gray-700 block mb-2">시안 파일 업로드 (선택)</label>
                              {inCart.file ? (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                  <div className="flex-1 text-sm text-green-700 font-medium truncate">{inCart.file.name}</div>
                                  <button onClick={() => setCart((p) => p.map((i) => i.productId===product.id ? {...i,file:null} : i))} className="text-green-500 hover:text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
                                  <Upload className="w-6 h-6 text-gray-400 mb-1.5" />
                                  <span className="text-sm text-gray-500">파일 선택 또는 드래그</span>
                                  <span className="text-xs text-gray-400 mt-0.5">PNG, JPG, PDF, AI, PSD</span>
                                  <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.eps" onChange={(e) => setCart((p) => p.map((i) => i.productId===product.id ? {...i,file:e.target.files?.[0]??null} : i))} />
                                </label>
                              )}
                            </div>
                            {/* 납기일 */}
                            <div>
                              <label className="text-sm font-semibold text-gray-700 block mb-2"><Calendar className="w-4 h-4 inline mr-1" />요청 납기일 (선택)</label>
                              <input type="date" value={inCart.dueDate} min={new Date(Date.now()+86400000).toISOString().split('T')[0]}
                                onChange={(e) => setCart((p) => p.map((i) => i.productId===product.id ? {...i,dueDate:e.target.value} : i))}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                            </div>
                            {/* 요청사항 */}
                            <div>
                              <label className="text-sm font-semibold text-gray-700 block mb-2">작업 요청사항</label>
                              <textarea value={inCart.requestNote} onChange={(e) => setCart((p) => p.map((i) => i.productId===product.id ? {...i,requestNote:e.target.value} : i))}
                                placeholder="색상, 사이즈, 특이사항 등" rows={3}
                                className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-900" />
                            </div>
                            {/* 소계 */}
                            <div className="flex justify-between pt-2 border-t border-gray-100">
                              <span className="text-sm text-gray-500">소계</span>
                              <span className="font-bold text-violet-600">
                                {(product.price*inCart.quantity+(inCart.cutting?(ROLL_PRODUCTS.includes(product.id)?inCart.quantity*CUTTING_PRICE_PER_M:(parseInt(inCart.cuttingPrice)||0)):0)).toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {cart.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-gray-700">합계</span>
                      <span className="text-2xl font-bold text-violet-600">{totalAmount.toLocaleString()}원</span>
                    </div>
                    <button onClick={() => setStep(2)} className="w-full bg-violet-600 text-white font-bold py-3.5 rounded-xl hover:bg-violet-700 transition-colors">
                      다음 단계 →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DIRECT STEP 2: 배송 정보 */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">배송 정보 입력</h2>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">주문명 <span className="text-gray-400 font-normal">(선택)</span></label>
                  <input type="text" value={orderName} onChange={(e) => setOrderName(e.target.value)} placeholder="예) 여름 신상 로고, 브랜드 패치" maxLength={50}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 mb-6">
                  {[{key:'name',label:'주문자 이름',ph:'홍길동',type:'text'},{key:'email',label:'이메일',ph:'example@email.com',type:'email'},{key:'phone',label:'연락처',ph:'010-1234-5678',type:'tel'},{key:'address',label:'배송지 주소',ph:'서울시 강남구 테헤란로 123',type:'text'}].map(({key,label,ph,type}) => (
                    <div key={key}>
                      <label className="text-sm font-semibold text-gray-700 block mb-1.5">{label} <span className="text-red-500">*</span></label>
                      <input type={type} value={customer[key as keyof CustomerInfo]} onChange={(e) => setCustomer((p) => ({...p,[key]:e.target.value}))} placeholder={ph}
                        className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${errors[key as keyof CustomerInfo] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                      {errors[key as keyof CustomerInfo] && <p className="text-red-500 text-xs mt-1">{errors[key as keyof CustomerInfo]}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-600 py-3.5 rounded-xl hover:bg-gray-50">← 이전</button>
                  <button onClick={() => { if(validateCustomer()) setStep(3) }} className="flex-1 bg-violet-600 text-white font-bold py-3.5 rounded-xl hover:bg-violet-700">다음 단계 →</button>
                </div>
              </div>
            )}

            {/* DIRECT STEP 3: 결제 */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">주문 확인 및 결제</h2>
                {orderName.trim() && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
                    <span className="text-xs font-bold text-violet-500 shrink-0">주문명</span>
                    <span className="font-semibold text-gray-800">{orderName.trim()}</span>
                  </div>
                )}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
                  <h3 className="font-bold text-gray-700 mb-3">주문 상품</h3>
                  <div className="space-y-3">
                    {cart.map((item) => {
                      const p = ALL_PRODUCTS.find((x) => x.id===item.productId)!
                      const cutAmt = item.cutting?(ROLL_PRODUCTS.includes(item.productId)?item.quantity*CUTTING_PRICE_PER_M:(parseInt(item.cuttingPrice)||0)):0
                      return (
                        <div key={item.productId} className="flex justify-between items-start text-sm">
                          <div>
                            <div className="font-medium text-gray-800">{p.name}</div>
                            <div className="text-gray-500">{item.quantity}{p.unit}{item.cutting?' / 컷팅 있음':''}{item.file?` / 시안: ${item.file.name}`:''}{item.dueDate?` / 납기: ${item.dueDate}`:''}</div>
                          </div>
                          <div className="font-bold text-gray-800">{(p.price*item.quantity+cutAmt).toLocaleString()}원</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 text-sm space-y-1 text-gray-600">
                  <h3 className="font-bold text-gray-700 mb-2">배송 정보</h3>
                  {[['이름',customer.name],['이메일',customer.email],['연락처',customer.phone],['주소',customer.address]].map(([l,v]) => (
                    <div key={l}><span className="font-medium text-gray-700 w-14 inline-block">{l}</span>{v}</div>
                  ))}
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700">결제 금액</span>
                    <span className="text-2xl font-bold text-violet-600">{totalAmount.toLocaleString()}원</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">* 부가세(VAT 10%) 포함</p>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">결제 수단</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPayMethod('card')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${payMethod==='card' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>💳 카드 결제</button>
                    <button onClick={() => setPayMethod('bank')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${payMethod==='bank' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>🏦 무통장 입금</button>
                  </div>
                </div>
                {payMethod === 'bank' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 text-sm space-y-1.5">
                    <p className="font-bold text-orange-800 mb-2">입금 계좌 안내</p>
                    <div className="flex justify-between"><span className="text-gray-500">은행</span><span className="font-semibold">기업은행</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-bold tracking-wider">495-028223-01-021</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">예금주</span><span className="font-semibold">아유디스터디 (조봉준)</span></div>
                    <div className="flex justify-between border-t border-orange-200 pt-2 mt-1">
                      <span className="text-gray-500">입금 금액</span>
                      <span className="font-bold text-orange-700 text-base">{totalAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-600 py-3.5 rounded-xl hover:bg-gray-50">← 이전</button>
                  {payMethod === 'card' ? (
                    <button onClick={handlePayment} className="flex-1 bg-violet-600 text-white font-bold py-3.5 rounded-xl hover:bg-violet-700">카드 결제하기</button>
                  ) : (
                    <button onClick={handleBankTransfer} disabled={submitting} className="flex-1 bg-orange-500 text-white font-bold py-3.5 rounded-xl hover:bg-orange-600 disabled:opacity-50">
                      {submitting ? '처리 중...' : '입금 완료했습니다'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrderPage() {
  return <Suspense><OrderPageContent /></Suspense>
}
