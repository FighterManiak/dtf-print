'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Package, ShieldCheck, TrendingUp, Truck, Users, MessageCircle, AlertCircle, CreditCard, ShoppingCart, DollarSign, HardDrive, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

interface StorageStats {
  totalUsed: number
  totalLimit: number
  usedPercent: number
  buckets: { name: string; size: number }[]
}

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

interface VisitStats {
  today: { uv: number; pv: number }
  yesterday: { uv: number; pv: number }
  daily: { date: string; uv: number; pv: number }[]
  referrers: { name: string; count: number }[]
}

export default function AdminPage() {
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [visits, setVisits] = useState<VisitStats | null>(null)

  const [stats, setStats] = useState<Stats>({
    total: 0, inProgress: 0, monthRevenue: 0,
    todayOrders: 0, todayRevenue: 0, todayShipped: 0, pendingQuotes: 0, pendingPayment: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsSuperAdmin(user?.user_metadata?.role === 'superadmin')
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

      // orders / quotes 모두 RLS 우회를 위해 서비스롤 API로 조회 후 클라이언트에서 집계
      const [orders, quotes] = await Promise.all([
        fetch('/api/admin/list-orders').then((r) => r.ok ? r.json() : []).catch(() => []) as Promise<Array<{ status: string; total_amount: number | null; created_at: string; updated_at: string }>>,
        fetch('/api/admin/list-quotes').then((r) => r.ok ? r.json() : []).catch(() => []) as Promise<Array<{ status: string }>>,
      ])

      // 스토리지 통계 (병렬)
      fetch('/api/admin/storage-stats').then((r) => r.json()).then((s) => { if (!s.error) setStorage(s) })
      fetch('/api/admin/visit-stats').then((r) => r.json()).then((v) => { if (!v.error) setVisits(v) }).catch(() => {})

      const revenueStatuses = ['paid','in_progress','shipped','delivered']
      const sum = (arr: typeof orders) => arr.reduce((s, o) => s + (o.total_amount || 0), 0)

      setStats({
        total: orders.length,
        inProgress: orders.filter((o) => o.status === 'in_progress').length,
        monthRevenue: sum(orders.filter((o) => revenueStatuses.includes(o.status) && o.created_at >= monthStart)),
        todayOrders: orders.filter((o) => revenueStatuses.includes(o.status) && o.created_at >= todayStart).length,
        todayRevenue: sum(orders.filter((o) => revenueStatuses.includes(o.status) && o.created_at >= todayStart)),
        todayShipped: orders.filter((o) => o.status === 'shipped' && o.updated_at >= todayStart).length,
        pendingQuotes: quotes.filter((q) => q.status === 'pending').length,
        pendingPayment: orders.filter((o) => o.status === 'pending').length,
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
    { label: '입금 대기', value: loading ? '—' : `${stats.pendingPayment}건`, icon: CreditCard, color: 'text-violet-500', href: '/admin/quotes?status=order_pending' },
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
            <p className="text-gray-500 text-sm">가입 회원 목록 확인{isSuperAdmin ? ', 권한 변경' : ''}</p>
          </Link>

          <Link href="/admin/products"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-violet-300 hover:shadow-md transition-all">
            <Package className="w-8 h-8 text-violet-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">상품 관리</h2>
            <p className="text-gray-500 text-sm">바로주문 상품 등록·수정·삭제</p>
          </Link>

          <Link href="/admin/reviews"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-yellow-300 hover:shadow-md transition-all">
            <Star className="w-8 h-8 text-yellow-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">리뷰 관리</h2>
            <p className="text-gray-500 text-sm">고객 리뷰 노출 순서·고정·숨김·삭제</p>
          </Link>

          <Link href="/admin/chat"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all">
            <MessageCircle className="w-8 h-8 text-blue-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">문의 채팅</h2>
            <p className="text-gray-500 text-sm">고객 1:1 문의 실시간 채팅 관리</p>
          </Link>

          {/* 방문 통계 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-gray-500" />
              <h2 className="font-bold text-gray-800 text-lg">방문 통계</h2>
              <span className="text-xs text-gray-400 ml-auto">최근 7일</span>
            </div>

            {!visits ? (
              <p className="text-sm text-gray-400">불러오는 중...</p>
            ) : (
              <>
                {/* 오늘/어제 */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-blue-500 font-semibold mb-1">오늘 방문자</p>
                    <p className="text-2xl font-bold text-gray-900">{visits.today.uv}<span className="text-sm font-medium text-gray-400 ml-1">명</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">페이지뷰 {visits.today.pv}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-semibold mb-1">어제 방문자</p>
                    <p className="text-2xl font-bold text-gray-700">{visits.yesterday.uv}<span className="text-sm font-medium text-gray-400 ml-1">명</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">페이지뷰 {visits.yesterday.pv}</p>
                  </div>
                </div>

                {/* 최근 7일 추이 */}
                <p className="text-xs font-bold text-gray-500 mb-2">최근 7일 추이</p>
                <div className="flex items-end gap-1.5 h-24 mb-5">
                  {visits.daily.map((d) => {
                    const max = Math.max(...visits.daily.map((x) => x.uv), 1)
                    const h = Math.round((d.uv / max) * 100)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[10px] text-gray-500 mb-0.5">{d.uv}</span>
                        <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(h, 3)}%` }} title={`${d.date}: ${d.uv}명`} />
                        <span className="text-[10px] text-gray-400 mt-1">{d.date.slice(5).replace('-', '/')}</span>
                      </div>
                    )
                  })}
                </div>

                {/* 유입 경로 */}
                <p className="text-xs font-bold text-gray-500 mb-2">유입 경로</p>
                {visits.referrers.length === 0 ? (
                  <p className="text-xs text-gray-400">데이터 없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {visits.referrers.map((r) => {
                      const total = visits.referrers.reduce((s, x) => s + x.count, 0)
                      const pct = Math.round((r.count / total) * 100)
                      return (
                        <div key={r.name} className="flex items-center gap-2 text-xs">
                          <span className="w-24 shrink-0 text-gray-600 truncate">{r.name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-14 text-right text-gray-500">{r.count}회 ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 스토리지 현황 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-6 h-6 text-gray-500" />
              <h2 className="font-bold text-gray-800 text-lg">스토리지 현황</h2>
              <span className="text-xs text-gray-400 ml-auto">Supabase Pro 플랜</span>
            </div>
            {!storage ? (
              <div className="text-sm text-gray-400">불러오는 중...</div>
            ) : (
              <>
                {/* 전체 프로그레스바 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-700">
                      {storage.usedPercent}% 사용 중
                    </span>
                    <span className="text-gray-500">
                      {formatBytes(storage.totalUsed)} / {formatBytes(storage.totalLimit)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        storage.usedPercent >= 90 ? 'bg-red-500' :
                        storage.usedPercent >= 70 ? 'bg-orange-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(storage.usedPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>여유 공간: <span className="font-semibold text-gray-600">{formatBytes(storage.totalLimit - storage.totalUsed)}</span></span>
                    {storage.usedPercent >= 80 && (
                      <span className="text-orange-500 font-semibold">⚠ 용량 부족 주의</span>
                    )}
                  </div>
                </div>
                {/* 버킷별 상세 */}
                {storage.buckets.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">버킷별 사용량</p>
                    {storage.buckets.map((b) => (
                      <div key={b.name} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-36 truncate">{b.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-blue-400"
                            style={{ width: `${Math.min((b.size / storage.totalLimit) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-16 text-right">{formatBytes(b.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
