'use client'

import Link from 'next/link'
import { ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase-browser'
import { getDemoSession } from '@/lib/demo-auth'
import { useEffect, useState } from 'react'
import type { DBProduct } from '@/types'

export default function ProductsSection() {
  const [isVerified, setIsVerified] = useState(false)
  const [all, setAll] = useState<DBProduct[]>([])
  const products = all.filter((p) => !p.verified_only)
  const verifiedProducts = all.filter((p) => p.verified_only)

  useEffect(() => {
    fetch('/api/products').then((r) => r.ok ? r.json() : []).then((d) => setAll(Array.isArray(d) ? d : [])).catch(() => {})
    // 데모 세션 확인
    const demo = getDemoSession()
    if (demo) {
      setIsVerified(demo.user_metadata.role === 'dtf_verified')
      return
    }
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsVerified(data.user?.user_metadata?.role === 'dtf_verified')
    })
  }, [])

  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Products</p>
          <h2 className="text-4xl font-extrabold text-gray-900">상품 안내</h2>
          <p className="text-gray-500 mt-3">클릭하면 바로 주문 페이지로 이동합니다</p>
        </div>

        {/* 일반 상품 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/order?product=${product.id}`}
              className="group border border-gray-100 rounded-3xl p-7 hover:border-blue-200 hover:shadow-lg transition-all block bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">{product.name}</h3>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-all group-hover:translate-x-0.5 mt-0.5 shrink-0" />
              </div>
              <p className="text-gray-400 text-sm mb-5 leading-relaxed">{product.description}</p>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-2xl font-extrabold text-gray-900">{product.price.toLocaleString()}원</span>
                  <span className="text-gray-400 text-sm ml-1">/ {product.unit}</span>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-semibold">컷팅 가능</span>
              </div>
            </Link>
          ))}
        </div>

        {/* DTF 인증 전용 상품 (모두에게 노출, 비인증은 클릭 시 안내) */}
        {verifiedProducts.length > 0 && (
          <div className="border-t border-gray-100 pt-10">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-800">DTF 보유 인증 고객 전용</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">인증 회원 전용</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {verifiedProducts.map((product) => {
                const inner = (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-bold text-green-600">인증 전용</span>
                      </div>
                      {isVerified
                        ? <ChevronRight className="w-5 h-5 text-green-300 group-hover:text-green-500 transition-colors shrink-0" />
                        : <span className="text-sm">🔒</span>}
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">{product.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{product.description}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-green-600">{product.price.toLocaleString()}원</span>
                        <span className="text-gray-400 text-sm ml-1">/ {product.unit}</span>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{isVerified ? '주문 가능' : '인증 필요'}</span>
                    </div>
                  </>
                )
                return isVerified ? (
                  <Link key={product.id} href={`/order?product=${product.id}`} className="group border-2 border-green-300 bg-green-50 rounded-xl p-6 hover:shadow-md hover:border-green-500 transition-all block">
                    {inner}
                  </Link>
                ) : (
                  <button key={product.id} onClick={() => alert('DTF 장비 보유 인증 고객 전용 상품입니다.\n로그인 후 \'DTF 보유인증\'을 완료하면 주문할 수 있습니다.')}
                    className="text-left border-2 border-gray-200 bg-gray-50 rounded-xl p-6 hover:border-green-300 transition-all block">
                    {inner}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            href="/order?mode=quote"
            className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold px-10 py-4 rounded-2xl hover:bg-gray-700 transition-colors"
          >
            지금 바로 견적받기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
