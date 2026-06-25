'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Phone, MapPin } from 'lucide-react'

function ProfileSetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return }
    if (!address.trim()) { setError('주소를 입력해주세요.'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        phone: cleaned,
        address: address.trim() + (addressDetail.trim() ? ' ' + addressDetail.trim() : ''),
      }
    })

    if (updateError) {
      setError('저장에 실패했습니다: ' + updateError.message)
      setLoading(false)
      return
    }

    router.push(next)
  }

  const formatPhone = (value: string) => {
    const num = value.replace(/[^0-9]/g, '')
    if (num.length <= 3) return num
    if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Phone className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">기본 정보 등록</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            주문 및 배송 안내를 위해<br />연락처와 주소를 등록해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 전화번호 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              maxLength={13}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 주소 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              기본 배송지 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="도로명 주소 (예: 서울시 강남구 테헤란로 123)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
            />
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="상세 주소 (동, 호수 등)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장하고 시작하기'}
          </button>

          <button
            type="button"
            onClick={() => router.push(next)}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            나중에 입력하기
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ProfileSetupPage() {
  return (
    <Suspense>
      <ProfileSetupForm />
    </Suspense>
  )
}
