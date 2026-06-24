'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/types'

export default function MyOrdersPage() {
  const [email, setEmail] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSearched(true)
    // Supabase 연동 후 실제 조회 구현
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">내 주문 조회</h1>
      <p className="text-gray-500 mb-8">주문 시 입력한 이메일로 주문 내역을 조회하세요.</p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="주문 시 입력한 이메일 주소"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" /> 조회
        </button>
      </form>

      {searched && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-1">주문 내역이 없습니다.</p>
          <p className="text-sm">Supabase 연동 후 실제 주문 내역이 표시됩니다.</p>
        </div>
      )}

      {/* 주문 상태 안내 */}
      <div className="bg-gray-50 rounded-xl p-5 mt-6">
        <h3 className="font-bold text-gray-700 mb-3 text-sm">주문 상태 안내</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(ORDER_STATUS_LABEL) as [OrderStatus, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
