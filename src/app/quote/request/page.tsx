'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const PRODUCT_TYPES = [
  { id: 'A4', label: 'A4 출력', desc: '210×297mm 단품 출력' },
  { id: 'A3', label: 'A3 출력', desc: '297×420mm 단품 출력' },
  { id: 'roll_58', label: '58cm 롤 출력', desc: '58cm 폭 롤 단위 출력 (길이 미정)' },
  { id: 'other', label: '기타', desc: '직접 요구사항 입력' },
]

function QuoteRequestForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [productType, setProductType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      setCustomer({
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        address: user.user_metadata?.address || '',
      })
    }
    load()
  }, [])

  const handleSubmit = async () => {
    if (!userId) return
    setUploading(true)
    const supabase = createClient()

    let fileUrl = null
    let fileName = null

    if (file) {
      const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣._-]/g, '')
      const path = `${userId}/quotes/${Date.now()}_${safeName}`
      const { data: uploadData, error } = await supabase.storage.from('order-files').upload(path, file)
      console.log('업로드 결과:', { uploadData, error, path })
      if (error) {
        setUploading(false)
        alert(`파일 업로드 실패: ${error.message}`)
        return
      }
      fileUrl = path
      fileName = file.name
    }

    await supabase.from('quotes').insert({
      user_id: userId,
      user_name: customer.name,
      user_email: customer.email,
      user_phone: customer.phone,
      user_address: customer.address,
      product_type: productType,
      request_note: requestNote,
      file_url: fileUrl,
      file_name: fileName,
      status: 'pending',
    })

    setUploading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">견적 요청 완료!</h2>
        <p className="text-gray-500 mb-2">시안 파일을 검토 후 빠르게 견적을 보내드리겠습니다.</p>
        <p className="text-sm text-gray-400 mb-8">평균 견적 발송 시간: 영업일 기준 1~2시간 이내</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/my-quotes')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            견적 현황 확인
          </button>
          <button
            onClick={() => router.push('/')}
            className="border border-gray-300 text-gray-600 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">견적 요청</h1>
        <p className="text-gray-500 text-sm mb-8">시안 파일을 업로드하면 출력 길이 확인 후 견적을 보내드립니다.</p>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center mb-10">
          {[
            { num: 1, label: '상품 유형\n선택' },
            { num: 2, label: '시안 파일\n업로드' },
            { num: 3, label: '배송 정보\n확인' },
          ].map(({ num, label }, idx) => (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > num ? '✓' : num}
                </div>
                <span className={`text-xs mt-1.5 text-center whitespace-pre-line leading-tight font-medium ${step >= num ? 'text-blue-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {idx < 2 && (
                <div className={`h-0.5 flex-1 mx-2 mb-5 ${step > num ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1: 상품 유형 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">어떤 상품을 원하시나요?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {PRODUCT_TYPES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProductType(p.id)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    productType === p.id
                      ? 'border-blue-600 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`font-bold mb-1 ${productType === p.id ? 'text-blue-700' : 'text-gray-800'}`}>{p.label}</div>
                  <div className="text-sm text-gray-500">{p.desc}</div>
                </button>
              ))}
            </div>
            <button
              disabled={!productType}
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음 →
            </button>
          </div>
        )}

        {/* STEP 2: 파일 업로드 + 요구사항 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">시안 파일 업로드</h2>
            <div className="mb-5">
              {!file ? (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600 font-medium">파일을 선택하거나 드래그하세요</span>
                  <span className="text-xs text-gray-400 mt-1">PNG, JPG, AI, PDF, PSD 등 (최대 50MB)</span>
                  <input type="file" className="hidden" accept="image/*,.pdf,.ai,.psd,.eps" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {file.name.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 truncate">{file.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                  </div>
                  <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="mb-8">
              <label className="text-sm font-semibold text-gray-700 block mb-2">요구사항 / 참고사항</label>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="예) 색상을 최대한 선명하게 출력해주세요. 배경 제거 후 출력 원합니다. 롤 출력 시 약 3M 정도 예상됩니다."
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder:text-gray-400"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                ← 이전
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 배송 정보 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">배송 정보 확인</h2>
            <p className="text-sm text-gray-500 mb-5">기본 정보가 자동으로 입력됩니다. 필요시 수정하세요.</p>

            <div className="space-y-4 mb-6">
              {[
                { label: '이름', key: 'name', type: 'text', placeholder: '홍길동' },
                { label: '이메일', key: 'email', type: 'email', placeholder: 'example@email.com' },
                { label: '연락처', key: 'phone', type: 'tel', placeholder: '010-0000-0000' },
                { label: '배송지 주소', key: 'address', type: 'text', placeholder: '배송받으실 주소를 입력하세요' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={customer[key as keyof typeof customer]}
                    onChange={(e) => setCustomer((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                  />
                </div>
              ))}
            </div>

            {/* 요청 요약 */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold text-blue-600 uppercase mb-3">견적 요청 요약</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 shrink-0">상품 유형</span>
                  <span className="text-gray-800 font-semibold">{PRODUCT_TYPES.find(p => p.id === productType)?.label}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 shrink-0">시안 파일</span>
                  <span className="text-gray-800">{file ? file.name : '없음 (요구사항으로 대체)'}</span>
                </div>
                {requestNote && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 shrink-0">요구사항</span>
                    <span className="text-gray-700 break-all">{requestNote}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                ← 이전
              </button>
              <button
                onClick={handleSubmit}
                disabled={uploading || !customer.name || !customer.phone}
                className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? '제출 중...' : '견적 요청하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuoteRequestPage() {
  return (
    <Suspense>
      <QuoteRequestForm />
    </Suspense>
  )
}
