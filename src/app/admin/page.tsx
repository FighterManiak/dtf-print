'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Package, ShieldCheck, TrendingUp, Truck, Users, MessageCircle, AlertCircle, CreditCard, ShoppingCart, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Stats {
  total: number
  inProgress: number
  monthRevenue: number
  todayOrders: number
  todayRevenue: number
  todayShipped: number
  pendingQuotes: number
  pendingPayment: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({
    total: 0, inProgress: 0, monthRevenue: 0,
    todayOrders: 0, todayRevenue: 0, todayShipped: 0, pendingQuotes: 0, pendingPayment: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

      const [
        totalRes, inProgressRes, monthRevenueRes,
        todayOrdersRes, todayRevenueRes, todayShippedRes, pendingQuotesRes, pendingPaymentRes,
      ] = await Promise.all([
        // 전체 주문
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        // 작업 중
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        // 이번 달 매출
        supabase.from('orders').select('total_amount').in('status', ['paid','in_progress','shipped','delivered']).gte('created_at', monthStart),
        // 오늘 주문 수
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
        // 오늘 매출
        supabase.from('orders').select('total_amount').in('status', ['paid','in_progress','shipped','delivered']).gte('created_at', todayStart),
        // 오늘 출고 완료
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'shipped').gte('updated_at', todayStart),
        // 견적 검토 대기
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        // 입금 확인 대기
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'quoted'),
      ])

      setStats({
        total: totalRes.count || 0,
        inProgress: inProgressRes.count || 0,
        monthRevenue: (monthRevenueRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0),
        todayOrders: todayOrdersRes.count || 0,
        todayRevenue: (todayRevenueRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0),
        todayShipped: todayShippedRes.count || 0,
        pendingQuotes: pendingQuotesRes.count || 0,
        pendingPayment: pendingPaymentRes.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const todayCards = [
    { label: '오늘 주문', value: loading ? '—' : `${stats.todayOrders}건`, icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50', href: '/admin/quotes' },
    { label: '오늘 매출', value: loading ? '—' : `${stats.todayRevenue.toLocaleString()}원`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50', href: '/admin/quotes' },
    { label: '오늘 출고 완료', value: loading ? '—' : `${stats.todayShipped}건`, icon: Truck, color: 'text-green-500', bg: 'bg-green-50', href: '/admin/quotes?status=shipped' },
    { label: '견적 검토 대기', value: loading ? '—' : `${stats.pendingQuotes}건`, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', href: '/admin/quotes?status=pending', urgent: !loading && stats.pendingQuotes > 0 },
  ]

  const monthCards = [
    { label: '전체 주문', value: loading ? '—' : `${stats.total}건`, icon: ClipboardList, color: 'text-gray-500', href: '/admin/quotes' },
    { label: '작업 중', value: loading ? '—' : `${stats.inProgress}건`, icon: Package, color: 'text-blue-500', href: '/admin/quotes?status=in_progress' },
    { label: '입금 확인 대기', value: loading ? '—' : `${stats.pendingPayment}건`, icon: CreditCard, color: 'text-violet-500', href: '/admin/quotes?status=bank_transfer_pending' },
    { label: '이번 달 매출', value: loading ? '—' : `${stats.monthRevenue.toLocaleString()}원`, icon: TrendingUp, color: 'text-indigo-500', href: '/admin/quotes' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800">관리자 대시보드</h1>
          <span className="text-sm text-gray-400">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
        </div>

        {/* 오늘 현황 */}
        <div className="mb-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">오늘 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {todayCards.map(({ label, value, icon: Icon, color, bg, href, urgent }) => (
              <Link key={label} href={href}
                className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all relative ${urgent ? 'border-orange-300 ring-2 ring-orange-200' : 'border-gray-200'}`}>
                {urgent && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />}
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="text-xl font-bold text-gray-800">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* 누적 현황 */}
        <div className="mt-6 mb-8">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">누적 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {monthCards.map(({ label, value, icon: Icon, color, href }) => (
              <Link key={label} href={href} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <div className="text-xl font-bold text-gray-800">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* 메뉴 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/admin/quotes"
            className="bg-white border-2 border-blue-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-md transition-all md:col-span-2">
            <ClipboardList className="w-8 h-8 text-blue-600 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">주문 관리</h2>
            <p className="text-gray-500 text-sm">견적 요청 검토 → 견적 발송 → 입금 확인 → 작업 진행 → 출고 · 배송완료까지 통합 관리</p>
          </Link>

          <Link href="/admin/verifications"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-md transition-all">
            <ShieldCheck className="w-8 h-8 text-green-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">DTF 인증 관리</h2>
            <p className="text-gray-500 text-sm">장비 보유 인증 신청 확인 및 승인/반려 처리</p>
          </Link>

          <Link href="/admin/members"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all">
            <Users className="w-8 h-8 text-purple-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">회원 관리</h2>
            <p className="text-gray-500 text-sm">가입 회원 목록 확인, 권한 변경</p>
          </Link>

          <Link href="/admin/chat"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all">
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
