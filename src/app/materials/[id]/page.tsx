'use client'

import { useEffect, useState, use as usePromise } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, Package, ChevronLeft, Minus, Plus, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { openPostcode } from '@/lib/daum-postcode'
import { getShippingFee } from '@/lib/shipping'
import { compressImage } from '@/lib/image-compress'

interface Material {
  id: string; name: string; description: string | null; detail: string | null
  price: number; origin_price: number | null; unit: string; stock: number | null
  category: string | null; images: string[]
}
interface Review {
  id: string; created_at: string; user_name: string | null
  rating: number; content: string | null; images: string[]
}

const BANK = { bank: '기업은행', account: '495-028223-01-021', holder: '아유디스터디 (조봉준)' }

export default function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const router = useRouter()
  const [material, setMaterial] = useState<Material | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  // 주문 폼
  const [ordering, setOrdering] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', zonecode: '', address: '', addressDetail: '', deliveryMethod: 'delivery', paymentMethod: 'bank_transfer', memo: '' })

  // 리뷰 작성
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const supabase = createClient()
  const imgUrl = (path: string) => supabase.storage.from('material-images').getPublicUrl(path).data.publicUrl

  const load = () => {
    fetch(`/api/materials?id=${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.material) { setMaterial(d.material); setReviews(d.reviews || []) } })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        setUser({ id: u.id, email: u.email || '' })
        setForm((p) => ({
          ...p,
          name: u.user_metadata?.full_name || u.user_metadata?.name || '',
          phone: u.user_metadata?.phone || '',
          email: u.email || '',
          zonecode: u.user_metadata?.zonecode || '',
          address: u.user_metadata?.address || '',
          addressDetail: u.user_metadata?.address_detail || '',
        }))
      }
    })
  }, [id])

  const searchAddress = async () => {
    const r = await openPostcode()
    if (r) setForm((p) => ({ ...p, zonecode: r.zonecode, address: r.address }))
  }

  const productAmount = (material?.price || 0) * qty
  const isPickup = form.deliveryMethod === 'pickup'
  const shipping = isPickup ? 0 : getShippingFee(productAmount, form.zonecode).total
  const total = productAmount + shipping

  const submitOrder = async () => {
    if (!form.name.trim()) { alert('주문자 이름을 입력해주세요.'); return }
    if (!form.phone.trim()) { alert('연락처를 입력해주세요.'); return }
    if (!isPickup && !form.zonecode) { alert('우편번호 검색으로 배송지를 입력해주세요.'); return }
    if (!confirm(`${total.toLocaleString()}원 주문하시겠습니까?${form.paymentMethod === 'bank_transfer' ? `\n\n입금계좌: ${BANK.bank} ${BANK.account}\n예금주: ${BANK.holder}` : ''}`)) return

    setSubmitting(true)
    const res = await fetch('/api/materials/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: [{ materialId: id, qty }] }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      alert(`주문이 접수되었습니다.${form.paymentMethod === 'bank_transfer' ? `\n\n${BANK.bank} ${BANK.account}\n${total.toLocaleString()}원을 입금해주세요.` : ''}`)
      router.push('/my-materials')
    } else {
      alert(d.error || '주문에 실패했습니다.')
    }
    setSubmitting(false)
  }

  const submitReview = async () => {
    if (!reviewText.trim()) { alert('리뷰 내용을 입력해주세요.'); return }
    setReviewSubmitting(true)
    const paths: string[] = []
    for (const original of reviewFiles) {
      const f = await compressImage(original)
      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `reviews/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('material-images').upload(path, f)
      if (!error) paths.push(path)
    }
    const res = await fetch('/api/materials/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId: id, rating, content: reviewText, images: paths }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setReviewOpen(false); setReviewText(''); setReviewFiles([]); setRating(5)
      load()
      alert('리뷰가 등록되었습니다. 감사합니다!')
    } else alert(d.error || '리뷰 등록에 실패했습니다.')
    setReviewSubmitting(false)
  }

  if (loading) return <div className="text-center py-24 text-gray-400 text-sm">불러오는 중...</div>
  if (!material) return (
    <div className="text-center py-24">
      <p className="text-gray-500 mb-4">상품을 찾을 수 없습니다.</p>
      <Link href="/materials" className="text-blue-600 font-semibold hover:underline">자재 구매로 돌아가기</Link>
    </div>
  )

  const soldOut = material.stock != null && material.stock <= 0
  const avg = reviews.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ChevronLeft className="w-4 h-4" /> 자재 구매
      </Link>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* 이미지 */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3">
            {material.images?.[imgIdx] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(material.images[imgIdx])} alt={material.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-14 h-14" /></div>
            )}
          </div>
          {material.images?.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {material.images.map((p, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${i === imgIdx ? 'border-blue-500' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(p)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 정보 */}
        <div>
          {material.category && <p className="text-xs text-gray-400 mb-1">{material.category}</p>}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{material.name}</h1>
          {material.description && <p className="text-sm text-gray-500 mb-4">{material.description}</p>}

          {avg && (
            <div className="flex items-center gap-1.5 mb-4">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold text-gray-800">{avg}</span>
              <span className="text-sm text-gray-400">리뷰 {reviews.length}개</span>
            </div>
          )}

          <div className="flex items-baseline gap-2 mb-6 pb-6 border-b border-gray-200">
            {material.origin_price && material.origin_price > material.price && (
              <span className="text-gray-400 line-through">{material.origin_price.toLocaleString()}원</span>
            )}
            <span className="text-3xl font-extrabold text-gray-900">{material.price.toLocaleString()}원</span>
            <span className="text-gray-400">/ {material.unit}</span>
          </div>

          {soldOut ? (
            <div className="bg-gray-100 text-gray-500 text-center py-4 rounded-xl font-bold">품절되었습니다</div>
          ) : !ordering ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-semibold text-gray-700">수량</span>
                <div className="flex items-center border border-gray-300 rounded-xl">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-gray-500 hover:text-gray-800"><Minus className="w-4 h-4" /></button>
                  <span className="px-4 font-bold text-gray-900">{qty}</span>
                  <button onClick={() => setQty((q) => material.stock != null ? Math.min(material.stock, q + 1) : q + 1)} className="px-3 py-2 text-gray-500 hover:text-gray-800"><Plus className="w-4 h-4" /></button>
                </div>
                {material.stock != null && <span className="text-xs text-gray-400">재고 {material.stock}{material.unit}</span>}
              </div>
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-gray-500">상품 금액</span>
                <span className="text-xl font-bold text-blue-600">{productAmount.toLocaleString()}원</span>
              </div>
              <button onClick={() => { if (!user) { alert('로그인 후 주문할 수 있습니다.'); router.push('/login?redirect=/materials/' + id); return } setOrdering(true) }}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                구매하기
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="font-bold text-gray-800">주문 정보</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="주문자 이름 *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="연락처 *"
                  className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setForm((p) => ({ ...p, deliveryMethod: 'delivery' }))}
                  className={`rounded-xl p-2.5 border-2 text-sm font-bold ${!isPickup ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>🚚 택배 배송</button>
                <button onClick={() => setForm((p) => ({ ...p, deliveryMethod: 'pickup' }))}
                  className={`rounded-xl p-2.5 border-2 text-sm font-bold ${isPickup ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>🏢 직접 수령</button>
              </div>

              {!isPickup && (
                <>
                  <div className="flex gap-2">
                    <input value={form.zonecode} readOnly placeholder="우편번호" className="w-24 border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-900" />
                    <button onClick={searchAddress} className="px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold whitespace-nowrap">우편번호 검색</button>
                  </div>
                  <input value={form.address} readOnly placeholder="기본 주소" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-900" />
                  <input value={form.addressDetail} onChange={(e) => setForm((p) => ({ ...p, addressDetail: e.target.value }))} placeholder="상세 주소"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setForm((p) => ({ ...p, paymentMethod: 'bank_transfer' }))}
                  className={`rounded-xl p-2.5 border-2 text-sm font-bold ${form.paymentMethod === 'bank_transfer' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500'}`}>무통장 입금</button>
                <button onClick={() => setForm((p) => ({ ...p, paymentMethod: 'CARD' }))}
                  className={`rounded-xl p-2.5 border-2 text-sm font-bold ${form.paymentMethod === 'CARD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>카드 결제</button>
              </div>

              {form.paymentMethod === 'bank_transfer' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-gray-700">
                  <p className="font-bold text-orange-800 mb-1">입금 계좌</p>
                  {BANK.bank} <b>{BANK.account}</b><br />예금주: {BANK.holder}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>상품 금액 ({qty}{material.unit})</span><span>{productAmount.toLocaleString()}원</span></div>
                <div className="flex justify-between text-gray-600"><span>배송비</span><span>{shipping === 0 ? '무료' : `${shipping.toLocaleString()}원`}</span></div>
                <div className="flex justify-between font-bold text-blue-700 border-t border-gray-200 pt-2 mt-1"><span>총 결제금액</span><span>{total.toLocaleString()}원</span></div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setOrdering(false)} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50">취소</button>
                <button onClick={submitOrder} disabled={submitting} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? '처리 중...' : '주문하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 설명 */}
      {material.detail && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">상품 상세</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{material.detail}</p>
        </div>
      )}

      {/* 리뷰 */}
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">리뷰 {reviews.length > 0 && <span className="text-blue-600">{reviews.length}</span>}</h2>
          {user && <button onClick={() => setReviewOpen(true)} className="text-sm font-semibold text-blue-600 hover:underline">리뷰 쓰기</button>}
        </div>

        {reviews.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">아직 리뷰가 없습니다. 첫 리뷰를 남겨주세요!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{r.user_name || '고객'}</span>
                  <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {r.content && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{r.content}</p>}
                {r.images?.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {r.images.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={imgUrl(p)} alt="" className="w-20 h-20 rounded-lg object-cover cursor-pointer"
                        onClick={() => window.open(imgUrl(p), '_blank')} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 리뷰 작성 모달 */}
      {reviewOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">리뷰 쓰기</h3>
              <button onClick={() => setReviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{material.name}</p>

            <div className="flex gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} onClick={() => setRating(i + 1)}>
                  <Star className={`w-7 h-7 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>

            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={5}
              placeholder="상품은 어떠셨나요? 솔직한 후기를 남겨주세요."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3" />

            <div className="flex gap-2 flex-wrap mb-4">
              {reviewFiles.map((f, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setReviewFiles((p) => p.filter((_, x) => x !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {reviewFiles.length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const fs = Array.from(e.target.files || []); setReviewFiles((p) => [...p, ...fs].slice(0, 5)); e.target.value = '' }} />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setReviewOpen(false)} disabled={reviewSubmitting} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={submitReview} disabled={reviewSubmitting} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {reviewSubmitting ? '등록 중...' : '리뷰 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
