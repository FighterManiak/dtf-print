'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Coins, Plus, Minus, Clock, Gift, Copy, Check } from 'lucide-react'

interface PointRow {
  id: string
  created_at: string
  amount: number
  type: string
  balance_remaining: number | null
  expires_at: string | null
  memo: string | null
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })

export default function MyPointsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(0)
  const [usable, setUsable] = useState(false)
  const [threshold, setThreshold] = useState(10000)
  const [expiringSoon, setExpiringSoon] = useState(0)
  const [rows, setRows] = useState<PointRow[]>([])
  const [referral, setReferral] = useState<{ code: string; link: string; referrerReward: number; refereeReward: number } | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const copyText = async (text: string, which: 'code' | 'link') => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 2000) } catch { /* 무시 */ }
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      fetch('/api/referral/me').then((r) => r.ok ? r.json() : null).then((d) => { if (d?.code) setReferral(d) }).catch(() => {})
      const res = await fetch('/api/points/history')
      if (res.ok) {
        const d = await res.json()
        setAvailable(d.available || 0)
        setUsable(!!d.usable)
        setThreshold(d.threshold || 10000)
        setExpiringSoon(d.expiringSoon || 0)
        setRows(d.transactions || [])
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">내 포인트</h1>

      {/* 보유 포인트 카드 */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-500 rounded-2xl p-6 text-white shadow-lg mb-4">
        <div className="flex items-center gap-2 text-violet-100 text-sm mb-1">
          <Coins className="w-4 h-4" /> 사용 가능 포인트
        </div>
        <div className="text-3xl font-bold">{available.toLocaleString()}<span className="text-lg font-medium">P</span></div>
        <div className="mt-3 text-xs text-violet-100">
          {usable
            ? '주문 시 사용할 수 있습니다.'
            : `${threshold.toLocaleString()}P 이상 보유 시 사용할 수 있습니다.`}
        </div>
      </div>

      {expiringSoon > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-3 text-sm mb-6">
          <Clock className="w-4 h-4 shrink-0" />
          30일 내 <b className="mx-1">{expiringSoon.toLocaleString()}P</b> 가 만료 예정입니다.
        </div>
      )}

      {/* 친구 추천 */}
      {referral && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-pink-500" />
            <span className="font-bold text-gray-800">친구 추천</span>
          </div>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            친구가 내 코드로 가입하고 첫 주문을 완료하면<br />
            나는 <b className="text-violet-600">{referral.referrerReward.toLocaleString()}P</b>, 친구는 <b className="text-violet-600">{referral.refereeReward.toLocaleString()}P</b>를 받아요.
          </p>
          <div className="flex gap-2 mb-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold tracking-widest text-gray-800">{referral.code}</div>
            <button onClick={() => copyText(referral.code, 'code')}
              className="px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center gap-1.5">
              {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'code' ? '복사됨' : '코드 복사'}
            </button>
          </div>
          <button onClick={() => copyText(referral.link, 'link')}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5">
            {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'link' ? '가입 링크 복사됨!' : '가입 링크 복사'}
          </button>
        </div>
      )}

      {/* 적립 안내 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 text-sm text-gray-600 leading-relaxed">
        <p className="font-bold text-gray-700 mb-2">💜 적립 안내</p>
        <p>· 배송 완료 시 등급별로 상품금액의 일정 비율이 적립됩니다.</p>
        <p>· VIP 3% · GOLD 2% · SILVER 1% (전월 롤 출력량 기준 등급)</p>
        <p>· 적립일로부터 <b>6개월</b> 이내 사용해야 하며, 미사용 시 소멸됩니다.</p>
      </div>

      {/* 내역 */}
      <h2 className="font-bold text-gray-800 mb-3">포인트 내역</h2>
      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-2xl">포인트 내역이 없습니다.</div>
        )}
        {rows.map((r) => {
          const isEarn = r.type === 'earn'
          return (
            <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isEarn ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}>
                  {isEarn ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{r.memo || (isEarn ? '적립' : '사용')}</div>
                  <div className="text-xs text-gray-400">
                    {fmtDate(r.created_at)}
                    {isEarn && r.expires_at && ` · ${fmtDate(r.expires_at)} 만료`}
                  </div>
                </div>
              </div>
              <div className={`font-bold text-sm shrink-0 ${isEarn ? 'text-violet-600' : 'text-gray-500'}`}>
                {isEarn ? '+' : ''}{r.amount.toLocaleString()}P
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
