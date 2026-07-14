'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

interface Review {
  id: string
  created_at: string
  user_name: string
  rating: number
  content: string | null
  image_urls: string[]
  order_name: string | null
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  )
}

const maskName = (name: string) => name.length <= 1 ? name : name[0] + '*'.repeat(Math.max(1, name.length - 1))

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    fetch('/api/reviews?limit=12').then((r) => r.ok ? r.json() : []).then((d) => setReviews(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  if (reviews.length === 0) return null

  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)

  return (
    <section className="bg-gray-50 py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Reviews</p>
          <h2 className="text-4xl font-extrabold text-gray-900">고객 리뷰</h2>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Stars n={Math.round(Number(avg))} />
            <span className="text-lg font-bold text-gray-800">{avg}</span>
            <span className="text-gray-400 text-sm">({reviews.length}개 리뷰)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Stars n={r.rating} />
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.image_urls.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto">
                  {r.image_urls.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="리뷰 이미지" className="w-20 h-20 object-cover rounded-lg shrink-0" />
                  ))}
                </div>
              )}
              {r.content && <p className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">{r.content}</p>}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium text-gray-600">{maskName(r.user_name)}</span>
                {r.order_name && <span>· {r.order_name}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
