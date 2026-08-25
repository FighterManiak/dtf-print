'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Material {
  id: string
  name: string
  description: string | null
  price: number
  origin_price: number | null
  unit: string
  stock: number | null
  category: string | null
  images: string[]
  reviewCount: number
  rating: number | null
}

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('전체')

  useEffect(() => {
    fetch('/api/materials')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const imgUrl = (path: string) => {
    const supabase = createClient()
    return supabase.storage.from('material-images').getPublicUrl(path).data.publicUrl
  }

  const categories = ['전체', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))]
  const filtered = category === '전체' ? items : items.filter((i) => i.category === category)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-2">Materials</p>
        <h1 className="text-3xl font-extrabold text-gray-900">자재 구매</h1>
        <p className="text-gray-500 mt-2">DTF 작업에 필요한 자재를 합리적인 가격에 만나보세요.</p>
      </div>

      {/* 카테고리 */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${category === c ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-center py-24 text-gray-400 text-sm">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((m) => {
            const soldOut = m.stock != null && m.stock <= 0
            const discount = m.origin_price && m.origin_price > m.price
              ? Math.round((1 - m.price / m.origin_price) * 100) : 0
            return (
              <Link key={m.id} href={`/materials/${m.id}`} className="group">
                {/* 사진 */}
                <div className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3">
                  {m.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl(m.images[0])} alt={m.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="w-10 h-10" />
                    </div>
                  )}
                  {soldOut && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">품절</span>
                    </div>
                  )}
                  {discount > 0 && !soldOut && (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">{discount}%</span>
                  )}
                </div>

                {/* 상품명 · 가격 */}
                <div>
                  {m.category && <p className="text-[11px] text-gray-400 mb-0.5">{m.category}</p>}
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">{m.name}</h3>
                  {m.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.description}</p>}
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    {m.origin_price && m.origin_price > m.price && (
                      <span className="text-xs text-gray-400 line-through">{m.origin_price.toLocaleString()}</span>
                    )}
                    <span className="text-base font-bold text-gray-900">{m.price.toLocaleString()}원</span>
                    <span className="text-xs text-gray-400">/ {m.unit}</span>
                  </div>
                  {m.reviewCount > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-semibold text-gray-700">{m.rating}</span>
                      <span className="text-xs text-gray-400">({m.reviewCount})</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
