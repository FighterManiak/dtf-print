'use client'

import { useEffect, useState } from 'react'
import { Package, Plus, X, Upload, Trash2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { compressImage } from '@/lib/image-compress'

interface Material {
  id: string; name: string; description: string | null; detail: string | null
  price: number; origin_price: number | null; unit: string; stock: number | null
  category: string | null; images: string[]; is_active: boolean; sort_order: number
}

const empty = {
  id: '', name: '', description: '', detail: '', price: '', originPrice: '',
  unit: '개', stock: '', category: '', images: [] as string[], isActive: true, sortOrder: '0',
}

export default function AdminMaterialsPage() {
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ ...empty })

  const supabase = createClient()
  const imgUrl = (p: string) => supabase.storage.from('material-images').getPublicUrl(p).data.publicUrl

  const load = () => {
    setLoading(true)
    fetch('/api/admin/materials')
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setForm({ ...empty }); setModalOpen(true) }
  const openEdit = (m: Material) => {
    setForm({
      id: m.id, name: m.name, description: m.description || '', detail: m.detail || '',
      price: String(m.price), originPrice: m.origin_price ? String(m.origin_price) : '',
      unit: m.unit || '개', stock: m.stock == null ? '' : String(m.stock),
      category: m.category || '', images: m.images || [], isActive: m.is_active, sortOrder: String(m.sort_order ?? 0),
    })
    setModalOpen(true)
  }

  const uploadImages = async (files: File[]) => {
    setUploading(true)
    const paths: string[] = []
    for (const original of files.slice(0, 8)) {
      const f = await compressImage(original, { maxWidth: 1400, maxHeight: 1400, quality: 0.85 })
      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('material-images').upload(path, f)
      if (!error) paths.push(path)
    }
    setForm((p) => ({ ...p, images: [...p.images, ...paths].slice(0, 8) }))
    setUploading(false)
  }

  const save = async () => {
    if (!form.name.trim()) { alert('상품명을 입력해주세요.'); return }
    if (form.price === '' || Number(form.price) < 0) { alert('가격을 입력해주세요.'); return }
    setSaving(true)
    const isEdit = !!form.id
    const res = await fetch('/api/admin/materials', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { setModalOpen(false); load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '저장 실패') }
    setSaving(false)
  }

  const toggleActive = async (m: Material) => {
    await fetch('/api/admin/materials', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, isActive: !m.is_active }),
    })
    load()
  }

  const remove = async (m: Material) => {
    if (!confirm(`"${m.name}" 상품을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return
    await fetch(`/api/admin/materials?id=${m.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">자재 상품 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 {items.length}개 · 판매중 {items.filter((i) => i.is_active).length}개</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700">
            <Plus className="w-4 h-4" /> 신규 상품 등록
          </button>
        </div>

        {loading ? (
          <p className="text-center py-20 text-gray-400 text-sm">불러오는 중...</p>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-20">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">등록된 상품이 없습니다.</p>
            <button onClick={openNew} className="text-blue-600 font-semibold text-sm hover:underline">첫 상품 등록하기</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((m) => (
              <div key={m.id} className={`bg-white border rounded-2xl overflow-hidden ${m.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                <div className="aspect-square bg-gray-100 relative">
                  {m.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl(m.images[0])} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-8 h-8" /></div>
                  )}
                  {!m.is_active && <span className="absolute top-2 left-2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded">숨김</span>}
                </div>
                <div className="p-3">
                  {m.category && <p className="text-[10px] text-gray-400">{m.category}</p>}
                  <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{m.name}</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{m.price.toLocaleString()}원 <span className="text-xs font-normal text-gray-400">/{m.unit}</span></p>
                  <p className="text-[11px] text-gray-400">재고 {m.stock == null ? '무제한' : `${m.stock}`}</p>
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => openEdit(m)} className="flex-1 text-xs bg-gray-100 text-gray-700 py-1.5 rounded-lg font-semibold hover:bg-gray-200">수정</button>
                    <button onClick={() => toggleActive(m)} title={m.is_active ? '숨기기' : '노출'}
                      className="px-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      {m.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => remove(m)} className="px-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">{form.id ? '상품 수정' : '신규 상품 등록'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {/* 이미지 */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">상품 사진 <span className="text-gray-400 font-normal">(첫 번째가 대표 이미지 · 최대 8장)</span></label>
                <div className="flex gap-2 flex-wrap">
                  {form.images.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl(p)} alt="" className="w-full h-full object-cover" />
                      {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-blue-600 text-white text-[9px] text-center py-0.5">대표</span>}
                      <button onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, x) => x !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {form.images.length < 8 && (
                    <label className={`w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-[10px] text-gray-400 mt-0.5">{uploading ? '업로드중' : '사진'}</span>
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) uploadImages(fs); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">상품명 <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예) DTF 전사필름 60cm x 100M"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">분류</label>
                  <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="필름 / 파우더 / 잉크"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">단위</label>
                  <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="개 / 롤 / kg"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">판매가 <span className="text-red-500">*</span></label>
                  <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="50000"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">정가 <span className="text-gray-400 font-normal">(할인표시)</span></label>
                  <input type="number" value={form.originPrice} onChange={(e) => setForm((f) => ({ ...f, originPrice: e.target.value }))} placeholder="선택"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">재고 <span className="text-gray-400 font-normal">(빈칸=무제한)</span></label>
                  <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="무제한"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">짧은 설명 <span className="text-gray-400 font-normal">(목록에 표시)</span></label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="예) 고광택 · 이형성 우수"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">상세 설명 <span className="text-gray-400 font-normal">(상세페이지)</span></label>
                <textarea value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} rows={5}
                  placeholder={'규격, 사용법, 주의사항 등을 자유롭게 입력하세요.\n줄바꿈이 그대로 표시됩니다.'}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed" />
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">노출 순서 <span className="text-gray-400 font-normal">(작을수록 앞)</span></label>
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <label className="flex items-center gap-2 pb-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">판매중 (사이트 노출)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModalOpen(false)} disabled={saving}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={save} disabled={saving || uploading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : form.id ? '수정 저장' : '상품 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
