'use client'

import { useEffect, useState } from 'react'
import { Star, Trash2, Pin, Eye, EyeOff, Save } from 'lucide-react'

interface Review {
  id: string
  created_at: string
  user_name: string
  rating: number
  content: string | null
  image_urls: string[]
  order_name: string | null
  sort_order: number
  pinned: boolean
  hidden: boolean
}

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i<=n?'text-yellow-400 fill-yellow-400':'text-gray-300'}`} />)}</div>
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [sortEdits, setSortEdits] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/reviews')
    if (res.ok) setReviews(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
    const res = await fetch('/api/admin/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    if (res.ok) await load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || '실패') }
    setBusy(null)
  }

  const remove = async (id: string) => {
    if (!confirm('이 리뷰를 삭제할까요?')) return
    setBusy(id)
    const res = await fetch(`/api/admin/reviews?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
    setBusy(null)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">리뷰 관리</h1>
        <p className="text-sm text-gray-500 mb-6">노출 순서(숫자 작을수록 위) · 상단 고정 · 숨김 · 삭제를 설정합니다.</p>

        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className={`bg-white border rounded-2xl p-4 ${r.hidden ? 'border-gray-200 opacity-60' : r.pinned ? 'border-yellow-300' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Stars n={r.rating} />
                  <span className="text-sm font-medium text-gray-700">{r.user_name}</span>
                  {r.pinned && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">고정</span>}
                  {r.hidden && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">숨김</span>}
                </div>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.image_urls.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.image_urls.map((u, i) => <img key={i} src={u} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />)}
                </div>
              )}
              {r.content && <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{r.content}</p>}
              {r.order_name && <p className="text-xs text-gray-400 mb-3">주문: {r.order_name}</p>}

              <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">순서</span>
                  <input type="number" value={sortEdits[r.id] ?? r.sort_order} onChange={(e) => setSortEdits((p) => ({ ...p, [r.id]: Number(e.target.value) }))}
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900" />
                  {sortEdits[r.id] !== undefined && sortEdits[r.id] !== r.sort_order && (
                    <button onClick={() => patch(r.id, { sort_order: sortEdits[r.id] })} disabled={busy === r.id} className="bg-violet-600 text-white p-1.5 rounded-lg"><Save className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <button onClick={() => patch(r.id, { pinned: !r.pinned })} disabled={busy === r.id}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${r.pinned ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-300 text-gray-600'}`}>
                  <Pin className="w-3.5 h-3.5" /> {r.pinned ? '고정 해제' : '상단 고정'}
                </button>
                <button onClick={() => patch(r.id, { hidden: !r.hidden })} disabled={busy === r.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600">
                  {r.hidden ? <><Eye className="w-3.5 h-3.5" /> 노출</> : <><EyeOff className="w-3.5 h-3.5" /> 숨김</>}
                </button>
                <button onClick={() => remove(r.id)} disabled={busy === r.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <div className="text-center py-12 text-gray-400 text-sm bg-white border border-gray-200 rounded-2xl">등록된 리뷰가 없습니다.</div>}
        </div>
      </div>
    </div>
  )
}
