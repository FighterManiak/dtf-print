'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Package, ShieldCheck, TrendingUp, Truck, Users, MessageCircle, AlertCircle, CreditCard, ShoppingCart, DollarSign, HardDrive, Star, Mail, Trash2 } from 'lucide-react'
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
  unpaidCount: number
  unpaidAmount: number
}

interface PeriodStat {
  uv: number
  pv: number
  referrers: { name: string; count: number }[]
  keywords: { keyword: string; count: number; source?: string }[]
}
interface VisitStats {
  periods: {
    today: PeriodStat
    yesterday: PeriodStat
    last7: PeriodStat
    last30: PeriodStat
    all: PeriodStat
  }
  totalRecords: number
  daily: { date: string; uv: number; pv: number }[]
}

type VisitPeriod = 'today' | 'yesterday' | 'last7' | 'last30' | 'all'
const VISIT_PERIOD_LABELS: { key: VisitPeriod; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: 'last7', label: '최근 7일' },
  { key: 'last30', label: '최근 30일' },
  { key: 'all', label: '전체' },
]

export default function AdminPage() {
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [visits, setVisits] = useState<VisitStats | null>(null)
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod>('today')
  const [chartMetric, setChartMetric] = useState<'uv' | 'pv'>('uv')
  const [emailStats, setEmailStats] = useState<{
    total: { today: number; month: number; total: number }
    byType: { broadcast: { today: number; month: number; total: number }; quote: { today: number; month: number; total: number }; signup: { today: number; month: number; total: number } }
  } | null>(null)

  const [stats, setStats] = useState<Stats>({
    total: 0, inProgress: 0, monthRevenue: 0,
    todayOrders: 0, todayRevenue: 0, todayShipped: 0, pendingQuotes: 0, pendingPayment: 0,
    unpaidCount: 0, unpaidAmount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [memberStats, setMemberStats] = useState<{ today: number; week: number; month: number; total: number } | null>(null)
  const [chatStats, setChatStats] = useState<{ open: number; unanswered: number; todayNew: number } | null>(null)
  const [verifyStats, setVerifyStats] = useState<{ pending: number; todayNew: number; total: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsSuperAdmin(user?.user_metadata?.role === 'superadmin')
      // 한국시간(KST) 기준 오늘/이번달 시작 시각 (created_at은 UTC 저장 → UTC 문자열로 비교)
      const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
      const ky = kstNow.getUTCFullYear(), km = kstNow.getUTCMonth(), kd = kstNow.getUTCDate()
      const todayStart = new Date(Date.UTC(ky, km, kd) - 9 * 3600 * 1000).toISOString()
      const monthStart = new Date(Date.UTC(ky, km, 1) - 9 * 3600 * 1000).toISOString()

      // orders / quotes 모두 RLS 우회를 위해 서비스롤 API로 조회 후 클라이언트에서 집계
      const [orders, quotes] = await Promise.all([
        fetch('/api/admin/list-orders').then((r) => r.ok ? r.json() : []).catch(() => []) as Promise<Array<{ status: string; total_amount: number | null; created_at: string; updated_at: string; is_paid?: boolean | null }>>,
        fetch('/api/admin/list-quotes').then((r) => r.ok ? r.json() : []).catch(() => []) as Promise<Array<{ status: string }>>,
      ])

      // 스토리지 통계 (병렬)
      fetch('/api/admin/storage-stats').then((r) => r.json()).then((s) => { if (!s.error) setStorage(s) })
      fetch('/api/admin/visit-stats').then((r) => r.json()).then((v) => { if (!v.error) setVisits(v) }).catch(() => {})
      fetch('/api/admin/email-stats').then((r) => r.json()).then((e) => { if (e.available) setEmailStats(e) }).catch(() => {})
      fetch('/api/admin/member-stats').then((r) => r.ok ? r.json() : null).then((m) => { if (m && !m.error) setMemberStats(m) }).catch(() => {})
      fetch('/api/admin/chat-stats').then((r) => r.ok ? r.json() : null).then((c) => { if (c && !c.error) setChatStats(c) }).catch(() => {})
      fetch('/api/admin/verify-stats').then((r) => r.ok ? r.json() : null).then((v) => { if (v && !v.error) setVerifyStats(v) }).catch(() => {})

      const revenueStatuses = ['paid','in_progress','shipped','delivered']
      // 매출: 결제완료+ 상태이면서 미입금(후불, is_paid===false)이 아닌 건
      const isRevenue = (o: typeof orders[number]) => revenueStatuses.includes(o.status) && o.is_paid !== false
      const sum = (arr: typeof orders) => arr.reduce((s, o) => s + (o.total_amount || 0), 0)

      setStats({
        total: orders.length,
        inProgress: orders.filter((o) => o.status === 'in_progress').length,
        monthRevenue: sum(orders.filter((o) => isRevenue(o) && o.created_at >= monthStart)),
        todayOrders: orders.filter((o) => o.created_at >= todayStart && o.status !== 'cancelled' && o.status !== 'refunded').length,
        todayRevenue: sum(orders.filter((o) => isRevenue(o) && o.created_at >= todayStart)),
        todayShipped: orders.filter((o) => o.status === 'shipped' && o.updated_at >= todayStart).length,
        pendingQuotes: quotes.filter((q) => q.status === 'pending').length,
        pendingPayment: orders.filter((o) => o.status === 'pending').length,
        unpaidCount: orders.filter((o) => o.is_paid === false).length,
        unpaidAmount: sum(orders.filter((o) => o.is_paid === false)),
      })
      setLoading(false)
    }
    load()
  }, [])

  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const todayCards = [
    { label: '오늘 주문', value: loading ? '—' : `${stats.todayOrders}건`, icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50', href: `/admin/quotes?from=${todayStr}&to=${todayStr}&filter=orders` },
    { label: '오늘 매출', value: loading ? '—' : `${stats.todayRevenue.toLocaleString()}원`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50', href: `/admin/quotes?from=${todayStr}&to=${todayStr}&filter=revenue` },
    { label: '오늘 출고 완료', value: loading ? '—' : `${stats.todayShipped}건`, icon: Truck, color: 'text-green-500', bg: 'bg-green-50', href: '/admin/quotes?status=shipped' },
    { label: '오늘 신규 가입', value: memberStats ? `${memberStats.today}명` : '—', icon: Users, color: 'text-pink-500', bg: 'bg-pink-50', href: '/admin/members' },
    { label: '견적 검토 대기', value: loading ? '—' : `${stats.pendingQuotes}건`, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', href: '/admin/quotes?status=pending', urgent: !loading && stats.pendingQuotes > 0 },
  ]

  const monthCards = [
    { label: '전체 주문', value: loading ? '—' : `${stats.total}건`, icon: ClipboardList, color: 'text-gray-500', href: '/admin/quotes' },
    { label: '작업 중', value: loading ? '—' : `${stats.inProgress}건`, icon: Package, color: 'text-blue-500', href: '/admin/quotes?status=in_progress' },
    { label: '입금 대기', value: loading ? '—' : `${stats.pendingPayment}건`, icon: CreditCard, color: 'text-violet-500', href: '/admin/quotes?status=order_pending' },
    { label: '이번 달 매출', value: loading ? '—' : `${stats.monthRevenue.toLocaleString()}원`, icon: TrendingUp, color: 'text-indigo-500', href: '/admin/quotes' },
    { label: '전체 회원', value: memberStats ? `${memberStats.total}명` : '—', icon: Users, color: 'text-pink-500', href: '/admin/members', sub: memberStats ? `이번 달 +${memberStats.month} · 최근7일 +${memberStats.week}` : undefined },
    { label: '미입금(후불)', value: loading ? '—' : `${stats.unpaidCount}건`, icon: CreditCard, color: 'text-red-500', href: '/admin/quotes?filter=unpaid', sub: !loading && stats.unpaidCount > 0 ? `미수금 ${stats.unpaidAmount.toLocaleString()}원` : undefined },
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {todayCards.map(({ label, value, icon: Icon, color, bg, href, urgent }) => (
              <Link key={label} href={href}
                className={`bg-white border rounded-xl p-3 hover:shadow-md transition-all relative ${urgent ? 'border-orange-300 ring-2 ring-orange-200' : 'border-gray-200'}`}>
                {urgent && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="text-base font-bold text-gray-800">{value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* 누적 현황 */}
        <div className="mt-6 mb-8">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">누적 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {monthCards.map(({ label, value, icon: Icon, color, href, sub }) => (
              <Link key={label} href={href} className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-all">
                <Icon className={`w-4 h-4 ${color} mb-1.5`} />
                <div className="text-base font-bold text-gray-800">{value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
                {sub && <div className="text-[10px] text-pink-500 mt-1 font-medium">{sub}</div>}
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
            className={`bg-white border rounded-xl p-6 hover:shadow-md transition-all relative ${verifyStats && verifyStats.pending > 0 ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200 hover:border-green-300'}`}>
            {verifyStats && verifyStats.pending > 0 && (
              <span className="absolute top-4 right-4 flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                심사대기 {verifyStats.pending}
              </span>
            )}
            <ShieldCheck className="w-8 h-8 text-green-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">DTF 인증 관리</h2>
            <p className="text-gray-500 text-sm">장비 보유 인증 신청 확인 및 승인/반려 처리</p>
            {verifyStats && (
              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-gray-400">심사 대기</p>
                  <p className={`text-sm font-bold ${verifyStats.pending > 0 ? 'text-orange-500' : 'text-gray-800'}`}>{verifyStats.pending}건</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">오늘 신규</p>
                  <p className="text-sm font-bold text-gray-800">{verifyStats.todayNew}건</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">누적 신청</p>
                  <p className="text-sm font-bold text-gray-800">{verifyStats.total}건</p>
                </div>
              </div>
            )}
          </Link>

          <Link href="/admin/members"
            className={`bg-white border rounded-xl p-6 hover:shadow-md transition-all relative ${memberStats && memberStats.today > 0 ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-200 hover:border-purple-300'}`}>
            {memberStats && memberStats.today > 0 && (
              <span className="absolute top-4 right-4 flex items-center gap-1 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                오늘 +{memberStats.today}
              </span>
            )}
            <Users className="w-8 h-8 text-purple-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">회원 관리</h2>
            <p className="text-gray-500 text-sm">가입 회원 목록 확인{isSuperAdmin ? ', 권한 변경' : ''}</p>
            {memberStats && (
              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-gray-400">오늘</p>
                  <p className={`text-sm font-bold ${memberStats.today > 0 ? 'text-pink-500' : 'text-gray-800'}`}>{memberStats.today}명</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">최근 7일</p>
                  <p className="text-sm font-bold text-gray-800">{memberStats.week}명</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">이번 달</p>
                  <p className="text-sm font-bold text-gray-800">{memberStats.month}명</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">전체</p>
                  <p className="text-sm font-bold text-gray-800">{memberStats.total}명</p>
                </div>
              </div>
            )}
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
            className={`bg-white border rounded-xl p-6 hover:shadow-md transition-all relative ${chatStats && chatStats.unanswered > 0 ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200 hover:border-blue-300'}`}>
            {chatStats && chatStats.unanswered > 0 && (
              <span className="absolute top-4 right-4 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                미답변 {chatStats.unanswered}
              </span>
            )}
            <MessageCircle className="w-8 h-8 text-blue-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">문의 채팅</h2>
            <p className="text-gray-500 text-sm">고객 1:1 문의 실시간 채팅 관리</p>
            {chatStats && (
              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-gray-400">미답변</p>
                  <p className={`text-sm font-bold ${chatStats.unanswered > 0 ? 'text-red-500' : 'text-gray-800'}`}>{chatStats.unanswered}건</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">진행중</p>
                  <p className="text-sm font-bold text-gray-800">{chatStats.open}건</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">오늘 신규</p>
                  <p className="text-sm font-bold text-gray-800">{chatStats.todayNew}건</p>
                </div>
              </div>
            )}
          </Link>

          <Link href="/admin/deleted-orders"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-red-300 hover:shadow-md transition-all md:col-span-2">
            <Trash2 className="w-8 h-8 text-red-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">삭제된 주문 내역 <span className="text-xs text-gray-400 font-normal">감사 기록</span></h2>
            <p className="text-gray-500 text-sm">삭제된 모든 주문이 <b className="text-red-500">삭제자·시각·사유·원본 데이터</b>와 함께 영구 보관됩니다. 전체 관리자가 열람합니다.</p>
          </Link>

          <Link href="/admin/mail"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-md transition-all">
            <Mail className="w-8 h-8 text-emerald-500 mb-3" />
            <h2 className="font-bold text-gray-800 text-lg mb-1">회원 메일 발송</h2>
            <p className="text-gray-500 text-sm">전체·인증 회원에게 공지·안내 메일 발송</p>
            {emailStats && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-2 text-center mb-2">
                  <div>
                    <p className="text-[11px] text-gray-400">오늘</p>
                    <p className="text-sm font-bold text-gray-800">{emailStats.total.today.toLocaleString()}<span className="text-[10px] text-gray-400 ml-0.5">/100</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">이번 달</p>
                    <p className="text-sm font-bold text-gray-800">{emailStats.total.month.toLocaleString()}<span className="text-[10px] text-gray-400 ml-0.5">/3천</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">누적</p>
                    <p className="text-sm font-bold text-gray-800">{emailStats.total.total.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-[11px] text-gray-500 space-y-0.5 border-t border-gray-50 pt-2">
                  <div className="flex justify-between"><span>· 회원 발송</span><span className="text-gray-700">누적 {emailStats.byType.broadcast.total.toLocaleString()} · 이달 {emailStats.byType.broadcast.month.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>· 견적 안내</span><span className="text-gray-700">누적 {emailStats.byType.quote.total.toLocaleString()} · 이달 {emailStats.byType.quote.month.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>· 가입 인증</span><span className="text-gray-700">누적 {emailStats.byType.signup.total.toLocaleString()} · 이달 {emailStats.byType.signup.month.toLocaleString()}</span></div>
                </div>
              </div>
            )}
          </Link>

          {/* 방문 통계 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <TrendingUp className="w-6 h-6 text-gray-500" />
              <h2 className="font-bold text-gray-800 text-lg">방문 통계</h2>
              {visits && <span className="text-xs text-gray-400 ml-auto">누적 {visits.totalRecords.toLocaleString()} PV</span>}
            </div>

            {!visits ? (
              <p className="text-sm text-gray-400">불러오는 중...</p>
            ) : (() => {
              const cur = visits.periods[visitPeriod]
              const curLabel = VISIT_PERIOD_LABELS.find((p) => p.key === visitPeriod)?.label || ''
              return (
              <>
                {/* 기간 선택 */}
                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                  {VISIT_PERIOD_LABELS.map(({ key, label }) => (
                    <button key={key} onClick={() => setVisitPeriod(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${visitPeriod === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* 선택 기간 요약 */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-blue-500 font-semibold mb-1">{curLabel} 방문자 (순)</p>
                    <p className="text-2xl font-bold text-gray-900">{cur.uv.toLocaleString()}<span className="text-sm font-medium text-gray-400 ml-1">명</span></p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <p className="text-xs text-indigo-500 font-semibold mb-1">{curLabel} 페이지뷰</p>
                    <p className="text-2xl font-bold text-gray-900">{cur.pv.toLocaleString()}<span className="text-sm font-medium text-gray-400 ml-1">회</span></p>
                  </div>
                </div>

                {/* 오늘/어제/7일/30일/전체 한눈에 */}
                <div className="grid grid-cols-5 gap-2 mb-5">
                  {VISIT_PERIOD_LABELS.map(({ key, label }) => (
                    <button key={key} onClick={() => setVisitPeriod(key)}
                      className={`rounded-lg p-2.5 text-center border transition-colors ${visitPeriod === key ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
                      <p className="text-base font-bold text-gray-800 leading-tight">{visits.periods[key].uv.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">PV {visits.periods[key].pv.toLocaleString()}</p>
                    </button>
                  ))}
                </div>

                {/* 일별 추이 (30일) */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500">일별 추이 (최근 30일)</p>
                  <div className="flex gap-1">
                    {(['uv', 'pv'] as const).map((m) => (
                      <button key={m} onClick={() => setChartMetric(m)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${chartMetric === m ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>
                        {m === 'uv' ? '방문자' : '페이지뷰'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-0.5 h-24 mb-5">
                  {visits.daily.map((d) => {
                    const val = d[chartMetric]
                    const max = Math.max(...visits.daily.map((x) => x[chartMetric]), 1)
                    const h = Math.round((val / max) * 100)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className={`w-full rounded-t ${chartMetric === 'uv' ? 'bg-blue-500' : 'bg-indigo-500'}`} style={{ height: `${Math.max(h, 2)}%` }} title={`${d.date}: ${val}${chartMetric === 'uv' ? '명' : 'PV'}`} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 -mt-3 mb-5">
                  <span>{visits.daily[0]?.date.slice(5).replace('-', '/')}</span>
                  <span>{visits.daily[visits.daily.length - 1]?.date.slice(5).replace('-', '/')}</span>
                </div>

                {/* 유입 경로 (선택 기간) */}
                <p className="text-xs font-bold text-gray-500 mb-2">유입 경로 <span className="text-gray-400 font-normal">— {curLabel}</span></p>
                {cur.referrers.length === 0 ? (
                  <p className="text-xs text-gray-400">데이터 없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {cur.referrers.map((r) => {
                      const total = cur.referrers.reduce((s, x) => s + x.count, 0)
                      const pct = Math.round((r.count / total) * 100)
                      return (
                        <div key={r.name} className="flex items-center gap-2 text-xs">
                          <span className="w-24 shrink-0 text-gray-600 truncate">{r.name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-16 text-right text-gray-500">{r.count}회 ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 검색 키워드 (선택 기간) */}
                <div className="flex items-center gap-2 mt-5 mb-2">
                  <p className="text-xs font-bold text-gray-500">검색 키워드 <span className="text-gray-400 font-normal">— {curLabel}</span></p>
                  <span className="text-[10px] text-gray-400">※ 검색엔진이 전달한 경우만</span>
                </div>
                {cur.keywords.length === 0 ? (
                  <p className="text-xs text-gray-400">수집된 검색어가 없습니다. (구글·네이버는 대부분 검색어를 전달하지 않아요 — 서치콘솔 권장)</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cur.keywords.map((k) => (
                      <span key={k.keyword} className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-1 text-xs">
                        {k.source && <span className="text-[10px] text-emerald-500 font-semibold">[{k.source}]</span>}
                        {k.keyword}
                        <span className="bg-emerald-200 text-emerald-800 rounded-full px-1.5 text-[10px] font-bold">{k.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
              )
            })()}
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
