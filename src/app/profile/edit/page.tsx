'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Phone, MapPin, User, CheckCircle } from 'lucide-react'

export default function ProfileEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setEmail(user.email || '')
    setName(user.user_metadata?.full_name || user.user_metadata?.name || '')
    setPhone(formatPhone(user.user_metadata?.phone || ''))
    setCompany(user.user_metadata?.company || '')

    const fullAddress: string = user.user_metadata?.address || ''
    const lastSpace = fullAddress.lastIndexOf(' ')
    if (lastSpace > 0 && fullAddress.length - lastSpace < 20) {
      setAddress(fullAddress.slice(0, lastSpace))
      setAddressDetail(fullAddress.slice(lastSpace + 1))
    } else {
      setAddress(fullAddress)
    }
    setLoading(false)
  }

  const formatPhone = (value: string) => {
    const num = value.replace(/[^0-9]/g, '')
    if (num.length <= 3) return num
    if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length > 0 && cleaned.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return }

    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: name,
        phone: cleaned,
        company: company.trim(),
        address: address.trim() + (addressDetail.trim() ? ' ' + addressDetail.trim() : ''),
      }
    })

    if (updateError) {
      setError('저장에 실패했습니다: ' + updateError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">회원정보 변경</h1>
      <p className="text-sm text-gray-500 mb-8">연락처와 배송지를 수정할 수 있습니다.</p>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        {/* 이메일 (읽기 전용) */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">이메일</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm bg-gray-50 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">이메일은 변경할 수 없습니다.</p>
        </div>

        {/* 이름 */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">
            <User className="w-3.5 h-3.5 inline mr-1" />
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
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

        {/* 전화번호 */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">
            <Phone className="w-3.5 h-3.5 inline mr-1" />
            전화번호
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
            기본 배송지
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

        {saved && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4" />
            저장되었습니다!
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
