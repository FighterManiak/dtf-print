'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Package, ShieldCheck, TrendingUp, Truck, Users, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function AdminPage() {
  const [stats, setStats] = useState({ total: 0, inProgress: 0, shipped: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [totalRes, inProgressRes, shippedRes, revenueRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'shipped'),
        supabase.from('orders').select('total_amount').eq('status', 'paid').gte('created_at', monthStart),
      ])

      const monthlyRevenue = (revenueRes.data || []).reduce((sum, o) => sum + (o.total_amount || 0), 0)

      setStats({
        total: totalRes.count || 0,
        inProgress: inProgressRes.count || 0,
        shipped: shippedRes.count || 0,
        revenue: monthlyRevenue,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: '전체 주문', value: loading ? '—' : `${stats.total}건`, icon: ClipboardList },
    { label: '작업 중', value: loading ? '—' : `${stats.inProgress}건`, icon: Package },
    { label: '출고 완료', value: loading ? '—' : `${stats.shipped}건`, icon: Truck },
    { label: '이번 달 매출', value: loading ? '—' : `${stats.revenue.toLocaleString()}원`, icon: TrendingUp },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">관리자 대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
            <Icon className="w-6 h-6 text-blue-500 mb-2" />
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/quotes"
          className="bg-white border-2 border-blue-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-md transition-all md:col-span-2"
        >
          <ClipboardList className="w-8 h-8 text-blue-600 mb-3" />
          <h2 className="font-bold text-gray-800 text-lg mb-1">주문 관리</h2>
          <p className="text-gray-500 text-sm">견적 요청 검토 → 견적 발송 → 입금 확인 → 작업 진행 → 출고 · 배송완료까지 통합 관리</p>
        </Link>

        <Link
          href="/admin/verifications"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-md transition-all"
        >
          <ShieldCheck className="w-8 h-8 text-green-500 mb-3" />
          <h2 className="font-bold text-gray-800 text-lg mb-1">DTF 인증 관리</h2>
          <p className="text-gray-500 text-sm">장비 보유 인증 신청 확인 및 승인/반려 처리</p>
        </Link>

        <Link
          href="/admin/members"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all"
        >
          <Users className="w-8 h-8 text-purple-500 mb-3" />
          <h2 className="font-bold text-gray-800 text-lg mb-1">회원 관리</h2>
          <p className="text-gray-500 text-sm">가입 회원 목록 확인, 권한 변경</p>
        </Link>

        <Link
          href="/admin/chat"
          className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <MessageCircle className="w-8 h-8 text-blue-500 mb-3" />
          <h2 className="font-bold text-gray-800 text-lg mb-1">문의 채팅</h2>
          <p className="text-gray-500 text-sm">고객 1:1 문의 실시간 채팅 관리</p>
        </Link>

        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 opacity-50">
          <TrendingUp className="w-8 h-8 text-gray-400 mb-3" />
          <h2 className="font-bold text-gray-500 text-lg mb-1">매출 통계</h2>
          <p className="text-gray-400 text-sm">준비 중</p>
        </div>
      </div>
    </div>
    </div>
  )
}
