'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PRODUCTS, VERIFIED_PRODUCTS, type ProductId } from '@/types'
import { Scissors, Upload, X, Plus, Minus, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const formatPhone = (value: string) => {
  const num = value.replace(/[^0-9]/g, '')
  if (num.length <= 3) return num
  if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`
  return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`
}

interface CartItem {
  productId: ProductId
  quantity: number
  cutting: boolean
  cuttingPrice: string
  file: File | null
  requestNote: string
  dueDate: string
}

const ROLL_PRODUCTS: ProductId[] = ['roll_58_1m', 'roll_58_50m', 'roll_58_100m']
const CUTTING_PRICE_PER_M = 1000

const getCuttingPrice = (productId: ProductId, quantity: number, manualPrice: string): number => {
  if (ROLL_PRODUCTS.includes(productId)) return quantity * CUTTING_PRICE_PER_M
  return parseInt(manualPrice) || 0
}

interface CustomerInfo {
  name: string
  email: string
  phone: string
  address: string
}

export default function OrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [expandedProduct, setExpandedProduct] = useState<ProductId | null>(null)

  const ALL_PRODUCTS = [...PRODUCTS, ...VERIFIED_PRODUCTS]

  // URL 파라미터로 상품 자동 선택
  useEffect(() => {
    const productId = searchParams.get('product') as ProductId | null
    if (!productId) return
    const exists = ALL_PRODUCTS.find((p) => p.id === productId)
    if (!exists) return
    setCart([{ productId, quantity: 1, cutting: false, cuttingPrice: '', file: null, requestNote: '', dueDate: '' }])
    setExpandedProduct(productId)
  }, [])
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '', email: '', phone: '', address: '',
  })

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setCustomer({
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          email: user.email || '',
          phone: formatPhone(user.user_metadata?.phone || ''),
          address: user.user_metadata?.address || '',
        })
      } catch {}
    }
    loadUserInfo()
  }, [])
  const [errors, setErrors] = useState<Partial<CustomerInfo>>({})

  const getProduct = (id: ProductId) => ALL_PRODUCTS.find((p) => p.id === id)!

  const addProduct = (productId: ProductId) => {
    const exists = cart.find((i) => i.productId === productId)
    if (exists) return
    setCart((prev) => [...prev, { productId, quantity: 1, cutting: false, cuttingPrice: '', file: null, requestNote: '', dueDate: '' }])
    setExpandedProduct(productId)
  }

  const removeItem = (productId: ProductId) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const updateItem = (productId: ProductId, updates: Partial<CartItem>) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, ...updates } : i))
  }

  const handleFile = (productId: ProductId, file: File | null) => {
    updateItem(productId, { file })
  }

  const totalAmount = cart.reduce((sum, item) => {
    const product = getProduct(item.productId)
    const cutting = item.cutting ? getCuttingPrice(item.productId, item.quantity, item.cuttingPrice) : 0
    return sum + product.price * item.quantity + cutting
  }, 0)

  const validateCustomer = () => {
    const e: Partial<CustomerInfo> = {}
    if (!customer.name.trim()) e.name = '이름을 입력해주세요'
    if (!customer.email.trim() || !/\S+@\S+\.\S+/.test(customer.email)) e.email = '올바른 이메일을 입력해주세요'
    if (!customer.phone.trim()) e.phone = '연락처를 입력해주세요'
    if (!customer.address.trim()) e.address = '배송지를 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (cart.length === 0) return alert('상품을 선택해주세요.')
      setStep(2)
    } else if (step === 2) {
      if (!validateCustomer()) return
      setStep(3)
    }
  }

  const handlePayment = async () => {
    // 토스페이먼츠 연동 (Supabase 설정 후 활성화)
    alert('결제 기능은 Supabase + 토스페이먼츠 설정 후 활성화됩니다.')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* 스텝 인디케이터 */}
      <div className="flex items-center mb-10">
        {['상품 선택', '배송 정보', '최종 확인'].map((label, idx) => {
          const stepNum = (idx + 1) as 1 | 2 | 3
          const active = step === stepNum
          const done = step > stepNum
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors ${
                  done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {done ? '✓' : stepNum}
                </div>
                <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {idx < 2 && <div className={`h-0.5 w-full mx-2 -mt-5 ${step > stepNum ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* STEP 1: 상품 선택 */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">상품 선택 및 시안 파일 업로드</h2>

          {/* 상품 목록 */}
          <div className="space-y-3 mb-8">
            {PRODUCTS.map((product) => {
              const inCart = cart.find((i) => i.productId === product.id)
              const isExpanded = expandedProduct === product.id

              return (
                <div key={product.id} className={`border rounded-xl overflow-hidden transition-all ${inCart ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                  {/* 상품 헤더 */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.description}</div>
                      <div className="text-blue-600 font-bold mt-1">{product.price.toLocaleString()}원 / {product.unit}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {inCart ? (
                        <>
                          <button
                            onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                            className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => removeItem(product.id)}
                            className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => addProduct(product.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          선택
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 상품 상세 옵션 (선택된 경우) */}
                  {inCart && isExpanded && (
                    <div className="border-t border-blue-200 p-4 bg-white space-y-5">
                      {/* 수량 */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">수량</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateItem(product.id, { quantity: Math.max(1, inCart.quantity - 1) })}
                            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 text-black"
                          >
                            <Minus className="w-4 h-4 text-black" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inCart.quantity}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '')
                              const v = parseInt(raw)
                              updateItem(product.id, { quantity: isNaN(v) || v < 1 ? 1 : v })
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-16 text-center font-bold text-lg text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 py-1"
                          />
                          <button
                            onClick={() => updateItem(product.id, { quantity: inCart.quantity + 1 })}
                            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 text-black"
                          >
                            <Plus className="w-4 h-4 text-black" />
                          </button>
                          <span className="text-gray-500 text-sm">{product.unit}</span>
                        </div>
                      </div>

                      {/* 컷팅 옵션 */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                          <Scissors className="w-4 h-4 inline mr-1" />
                          컷팅 옵션
                        </label>
                        <div className="flex gap-3">
                          {[
                            { value: false, label: '컷팅 없음' },
                            { value: true, label: '컷팅 있음' },
                          ].map(({ value, label }) => (
                            <button
                              key={String(value)}
                              onClick={() => updateItem(product.id, { cutting: value })}
                              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                                inCart.cutting === value
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300 text-gray-600 hover:border-blue-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {inCart.cutting && (
                          <div className="mt-2">
                            {ROLL_PRODUCTS.includes(product.id) ? (
                              <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
                                <span className="text-xs text-blue-700 font-medium">컷팅 요금</span>
                                <span className="text-xs text-blue-500">1M당 {CUTTING_PRICE_PER_M.toLocaleString()}원 × {inCart.quantity}M</span>
                                <span className="ml-auto font-bold text-blue-700">{(inCart.quantity * CUTTING_PRICE_PER_M).toLocaleString()}원</span>
                              </div>
                            ) : (
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">컷팅 추가 금액 입력</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={inCart.cuttingPrice}
                                    onChange={(e) => updateItem(product.id, { cuttingPrice: e.target.value })}
                                    placeholder="0"
                                    className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
                                  />
                                  <span className="text-sm text-gray-500">원</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 시안 파일 업로드 */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                          시안 파일 업로드
                        </label>
                        {inCart.file ? (
                          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex-1 text-sm text-green-700 font-medium truncate">{inCart.file.name}</div>
                            <button
                              onClick={() => handleFile(product.id, null)}
                              className="text-green-500 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">파일을 클릭하거나 드래그하여 업로드</span>
                            <span className="text-xs text-gray-400 mt-1">PNG, JPG, PDF, AI, PSD (최대 50MB)</span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.eps"
                              onChange={(e) => handleFile(product.id, e.target.files?.[0] ?? null)}
                            />
                          </label>
                        )}
                      </div>

                      {/* 요청 납기일 */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          요청 납기일
                        </label>
                        <input
                          type="date"
                          value={inCart.dueDate}
                          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                          onChange={(e) => updateItem(product.id, { dueDate: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {inCart.dueDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            * 납기일은 요청사항이며, 작업 상황에 따라 변동될 수 있습니다.
                          </p>
                        )}
                      </div>

                      {/* 작업 요청사항 */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">작업 요청사항</label>
                        <textarea
                          value={inCart.requestNote}
                          onChange={(e) => updateItem(product.id, { requestNote: e.target.value })}
                          placeholder="색상, 사이즈, 특이사항 등 요청사항을 자유롭게 입력해주세요."
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
                        />
                      </div>

                      {/* 소계 */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">소계</span>
                        <span className="font-bold text-blue-600">
                          {(
                            product.price * inCart.quantity +
                            (inCart.cutting ? getCuttingPrice(product.id, inCart.quantity, inCart.cuttingPrice) : 0)
                          ).toLocaleString()}원
                          {inCart.cutting && !ROLL_PRODUCTS.includes(product.id) && !inCart.cuttingPrice && ' (컷팅 금액 미입력)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 총액 + 다음 */}
          {cart.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-gray-700">합계</span>
                <span className="text-2xl font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
              </div>
              {cart.some((i) => i.cutting) && (
                <p className="text-sm text-orange-500 mb-3">* 컷팅 옵션 선택 상품의 컷팅 금액은 별도 안내됩니다.</p>
              )}
              <button
                onClick={handleNextStep}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                다음 단계 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: 배송 정보 */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">배송 정보 입력</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            {[
              { key: 'name', label: '주문자 이름', placeholder: '홍길동', type: 'text' },
              { key: 'email', label: '이메일', placeholder: 'example@email.com', type: 'email' },
              { key: 'phone', label: '연락처', placeholder: '010-1234-5678', type: 'tel' },
              { key: 'address', label: '배송지 주소', placeholder: '서울시 강남구 테헤란로 123 (상세주소 포함)', type: 'text' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  {label} <span className="text-red-500">*</span>
                </label>
                <input
                  type={type}
                  value={customer[key as keyof CustomerInfo]}
                  onChange={(e) => setCustomer((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    errors[key as keyof CustomerInfo] ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors[key as keyof CustomerInfo] && (
                  <p className="text-red-500 text-xs mt-1">{errors[key as keyof CustomerInfo]}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-600 font-medium py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← 이전
            </button>
            <button
              onClick={handleNextStep}
              className="flex-2 flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              다음 단계 →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: 최종 확인 */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">주문 확인 및 결제</h2>

          {/* 주문 상품 확인 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h3 className="font-bold text-gray-700 mb-3">주문 상품</h3>
            <div className="space-y-3">
              {cart.map((item) => {
                const product = getProduct(item.productId)
                return (
                  <div key={item.productId} className="flex justify-between items-start text-sm">
                    <div>
                      <div className="font-medium text-gray-800">{product.name}</div>
                      <div className="text-gray-500">
                        {item.quantity}{product.unit} / {item.cutting ? '컷팅 있음' : '컷팅 없음'}
                        {item.file && ` / 시안: ${item.file.name}`}
                        {item.dueDate && ` / 납기일: ${item.dueDate}`}
                      </div>
                    </div>
                    <div className="font-bold text-gray-800">
                      {(
                        product.price * item.quantity +
                        (item.cutting ? getCuttingPrice(item.productId, item.quantity, item.cuttingPrice) : 0)
                      ).toLocaleString()}원
                      {item.cutting && ROLL_PRODUCTS.includes(item.productId) && (
                        <span className="block text-xs text-blue-500 font-normal">컷팅 {(item.quantity * CUTTING_PRICE_PER_M).toLocaleString()}원 포함</span>
                      )}
                      {item.cutting && !ROLL_PRODUCTS.includes(item.productId) && (
                        <span className="block text-xs text-orange-500 font-normal">+ 컷팅 별도</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 배송 정보 확인 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h3 className="font-bold text-gray-700 mb-3">배송 정보</h3>
            <div className="text-sm space-y-1 text-gray-600">
              <div><span className="font-medium text-gray-700 w-16 inline-block">이름</span>{customer.name}</div>
              <div><span className="font-medium text-gray-700 w-16 inline-block">이메일</span>{customer.email}</div>
              <div><span className="font-medium text-gray-700 w-16 inline-block">연락처</span>{customer.phone}</div>
              <div><span className="font-medium text-gray-700 w-16 inline-block">주소</span>{customer.address}</div>
            </div>
          </div>

          {/* 결제 금액 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-700">결제 금액</span>
              <span className="text-2xl font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
            </div>
            {cart.some((i) => i.cutting && !ROLL_PRODUCTS.includes(i.productId)) && (
              <p className="text-xs text-orange-500 mt-1">* A4/A3 컷팅 금액은 확인 후 별도 안내됩니다.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 text-gray-600 font-medium py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← 이전
            </button>
            <button
              onClick={handlePayment}
              className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              결제하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
