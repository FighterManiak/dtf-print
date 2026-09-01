'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Coins } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface OrphanRow { 일시: string; 금액: number; 잔여: number | null; 메모: string | null }
interface OrphanMember {
  userId: string; name: string; company: string; email: string
  건수: number; 적립총액: number; 회수가능액: number; 내역: OrphanRow[]
}

export default function OrphanPointsPage() {
  const [members, setMembers] = useState<OrphanMember[]>([])
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/orphan-points')
      .then(async (r) => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || '조회 실패') }
        return r.json()
      })
      .then((d) => { setMembers(d.members || []); setTotalRemaining(d.totalRemaining || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setIsSuperAdmin(data.user?.user_metadata?.role === 'superadmin'))
    load()
  }, [])

  const toggle = (id: string) => setSelected((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const revoke = async (all: boolean) => {
    const targets = all ? members.map((m) => m.userId) : [...selected]
    if (targets.length === 0) { alert('회수할 회원을 선택해주세요.'); return }
    const amount = members.filter((m) => targets.includes(m.userId)).reduce((s, m) => s + m.회수가능액, 0)
    if (!confirm(`${targets.length}명의 잘못 적립된 포인트 ${amount.toLocaleString()}P를 회수합니다.\n\n회수 내역은 각 회원의 포인트 내역에 기록됩니다.\n계속하시겠습니까?`)) return

    setRunning(true)
    const res = await fetch('/api/admin/orphan-points', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: targets }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      alert(`회수 완료\n\n대상 ${d.대상회원수}명 · ${d.회수건수}건 · ${(d.회수금액 || 0).toLocaleString()}P`)
      setSelected(new Set())
      load()
    } else alert(d.error || '회수에 실패했습니다.')
    setRunning(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-800 font-bold mb-1">열람 불가</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Coins className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900">잘못 적립된 포인트 정리</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          <b>삭제된 주문</b>에 연결되어 남아있는 적립 포인트입니다. 회수하면 각 회원 내역에 &apos;환수&apos;로 기록됩니다.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">대상 회원</p>
            <p className="text-lg font-bold text-gray-900">{members.length}명</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-0.5">적립 건수</p>
            <p className="text-lg font-bold text-gray-900">{members.reduce((s, m) => s + m.건수, 0)}건</p>
          </div>
          <div className={`rounded-xl p-4 border ${totalRemaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-0.5">회수 가능액</p>
            <p className={`text-lg font-bold ${totalRemaining > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{totalRemaining.toLocaleString()}P</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16">
            <p className="text-gray-400 text-sm">정리할 포인트가 없습니다. 👍</p>
          </div>
        ) : (
          <>
            {isSuperAdmin && (
              <div className="flex items-center justify-between gap-2 bg-amber-500 text-white rounded-xl px-4 py-3 mb-3 flex-wrap">
                <span className="text-sm font-semibold">
                  {selected.size > 0 ? `${selected.size}명 선택됨` : '회수할 회원을 선택하세요'}
                </span>
                <div className="flex gap-2">
                  {selected.size > 0 && (
                    <button onClick={() => revoke(false)} disabled={running}
                      className="text-sm bg-white text-amber-700 px-4 py-1.5 rounded-lg font-bold hover:bg-amber-50 disabled:opacity-50">
                      선택 회수
                    </button>
                  )}
                  <button onClick={() => revoke(true)} disabled={running}
                    className="text-sm bg-white/15 border border-white/30 px-4 py-1.5 rounded-lg font-bold hover:bg-white/25 disabled:opacity-50">
                    {running ? '처리 중...' : '전체 회수'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {members.map((m) => {
                const open = expanded === m.userId
                return (
                  <div key={m.userId} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-5 py-4">
                      {isSuperAdmin && (
                        <input type="checkbox" checked={selected.has(m.userId)} onChange={() => toggle(m.userId)}
                          className="w-4 h-4 accent-amber-600 shrink-0 cursor-pointer" />
                      )}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(open ? null : m.userId)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                          {m.company && <span className="text-xs text-gray-500">{m.company}</span>}
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            회수 대상 {m.회수가능액.toLocaleString()}P
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {m.email} · 적립 {m.건수}건 · 총 {m.적립총액.toLocaleString()}P
                        </div>
                      </div>
                      <button onClick={() => setExpanded(open ? null : m.userId)} className="shrink-0 text-gray-400">
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {open && (
                      <div className="border-t border-gray-100 p-4 space-y-1.5">
                        {m.내역.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <span className="text-gray-800">{r.메모 || '적립'}</span>
                              <span className="text-xs text-gray-400 ml-2">{r.일시}</span>
                            </div>
                            <span className="font-bold text-violet-600 shrink-0 ml-2">
                              +{r.금액.toLocaleString()}P
                              {r.잔여 != null && <span className="text-xs text-gray-400 ml-1">(잔여 {Number(r.잔여).toLocaleString()})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
