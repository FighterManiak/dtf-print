'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { openPostcode } from '@/lib/daum-postcode'
import { Phone, MapPin } from 'lucide-react'

function ProfileSetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [zonecode, setZonecode] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 추천인 링크로 진입했다면 자동 입력
  useEffect(() => {
    const saved = localStorage.getItem('referral_code')
    if (saved) setReferralCode(saved)
  }, [])

  const handlePostcodeSearch = async () => {
    const result = await openPostcode()
    if (result) { setZonecode(result.zonecode); setAddress(result.address) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return }
    if (!address.trim()) { setError('우편번호 검색으로 주소를 선택해주세요.'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        phone: cleaned,
        company: company.trim(),
        zonecode,
        address: address.trim(),
        address_detail: addressDetail.trim(),
        ...(referralCode.trim() ? { referred_by_code: referralCode.toUpperCase().trim() } : {}),
      }
    })

    if (!updateError) localStorage.removeItem('referral_code')

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

          {/* 회사명 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">회사명 (선택)</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="회사명 또는 브랜드명"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 추천인 코드 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">추천인 코드 (선택)</label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="예) SH3F7K2A"
              maxLength={10}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
            />
            <p className="text-xs text-gray-400 mt-1">첫 주문 배송완료 시 나와 추천인 모두 포인트를 받아요.</p>
          </div>

          {/* 주소 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              기본 배송지 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={zonecode}
                readOnly
                placeholder="우편번호"
                className="w-28 border border-gray-300 rounded-xl px-4 py-3 text-black text-sm bg-gray-50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePostcodeSearch}
                className="px-4 py-3 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                우편번호 검색
              </button>
            </div>
            <input
              type="text"
              value={address}
              readOnly
              placeholder="기본 주소 (검색으로 입력)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black text-sm bg-gray-50 focus:outline-none mb-2"
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
