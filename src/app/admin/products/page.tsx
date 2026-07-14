'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, Save, X } from 'lucide-react'
import type { DBProduct } from '@/types'

type Draft = Omit<DBProduct, 'active'> & { active: boolean }

const EMPTY: Draft = { id: '', name: '', description: '', price: 0, unit: 'M', is_roll: false, verified_only: false, cutting_available: false, active: true, sort_order: 0 }

export default function AdminProductsPage() {
  const [products, setProducts] = useState<DBProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, DBProduct>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/products')
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const setField = (id: string, patch: Partial<DBProduct>) =>
    setEditing((p) => ({ ...p, [id]: { ...(p[id] || products.find((x) => x.id === id)!), ...patch } }))

  const saveEdit = async (id: string) => {
    const row = editing[id]
    if (!row) return
    setSaving(id)
    const res = await fetch('/api/admin/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
    if (res.ok) { setEditing((p) => { const n = { ...p }; delete n[id]; return n }); await load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '저장 실패') }
    setSaving(null)
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`'${name}' 상품을 삭제할까요?\n(기존 주문 내역에는 영향 없습니다)`)) return
    setSaving(id)
    const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) await load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || '삭제 실패') }
    setSaving(null)
  }

  const create = async () => {
    if (!draft.id.trim() || !draft.name.trim()) { alert('상품 ID와 이름은 필수입니다.'); return }
    setSaving('__new__')
    const res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
    if (res.ok) { setCreating(false); setDraft(EMPTY); await load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '등록 실패') }
    setSaving(null)
  }

  const Flags = ({ v, onChange }: { v: DBProduct; onChange: (p: Partial<DBProduct>) => void }) => (
    <div className="flex flex-wrap gap-3 text-xs text-gray-700 font-medium">
      {([['is_roll', '롤(미터·컷팅)'], ['cutting_available', '컷팅 옵션'], ['verified_only', 'DTF인증 전용'], ['active', '판매중']] as const).map(([k, label]) => (
        <label key={k} className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-violet-600" checked={!!v[k as keyof DBProduct]} onChange={(e) => onChange({ [k]: e.target.checked })} />
          {label}
        </label>
      ))}
    </div>
  )

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">바로주문 상품 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">주문 페이지에 노출되는 상품을 등록·수정·삭제합니다.</p>
          </div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700">
            <Plus className="w-4 h-4" /> 상품 추가
          </button>
        </div>

        {/* 신규 등록 */}
        {creating && (
          <div className="bg-white border-2 border-violet-200 rounded-2xl p-5 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">새 상품 등록</h2>
              <button onClick={() => { setCreating(false); setDraft(EMPTY) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-600 font-medium">상품 ID (영문/숫자)</label><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="roll_58_200m" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
              <div><label className="text-xs text-gray-600 font-medium">상품명</label><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="58cm × 200M 이상" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
              <div className="col-span-2"><label className="text-xs text-gray-600 font-medium">설명</label><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
              <div><label className="text-xs text-gray-600 font-medium">가격(원)</label><input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
              <div><label className="text-xs text-gray-600 font-medium">단위</label><input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="M / 장" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
              <div><label className="text-xs text-gray-600 font-medium">정렬 순서</label><input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
            </div>
            <Flags v={draft as DBProduct} onChange={(p) => setDraft({ ...draft, ...p })} />
            <button onClick={create} disabled={saving === '__new__'} className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {saving === '__new__' ? '등록 중...' : '등록'}
            </button>
          </div>
        )}

        {/* 상품 목록 */}
        <div className="space-y-3">
          {products.map((p) => {
            const cur = editing[p.id] || p
            const dirty = !!editing[p.id]
            return (
              <div key={p.id} className={`bg-white border rounded-2xl p-4 ${dirty ? 'border-violet-300' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-2 shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-gray-600 font-medium">상품명</label><input value={cur.name} onChange={(e) => setField(p.id, { name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div><label className="text-xs text-gray-600 font-medium">가격(원)</label><input type="number" value={cur.price} onChange={(e) => setField(p.id, { price: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div className="col-span-2"><label className="text-xs text-gray-600 font-medium">설명</label><input value={cur.description} onChange={(e) => setField(p.id, { description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div><label className="text-xs text-gray-600 font-medium">단위</label><input value={cur.unit} onChange={(e) => setField(p.id, { unit: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div><label className="text-xs text-gray-600 font-medium">정렬</label><input type="number" value={cur.sort_order} onChange={(e) => setField(p.id, { sort_order: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400" /></div>
                    <div className="col-span-2 pt-1"><Flags v={cur} onChange={(patch) => setField(p.id, patch)} /></div>
                    <div className="col-span-2 text-[11px] text-gray-400">ID: {p.id}</div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {dirty && (
                      <button onClick={() => saveEdit(p.id)} disabled={saving === p.id} className="flex items-center gap-1 bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" /> 저장
                      </button>
                    )}
                    <button onClick={() => remove(p.id, p.name)} disabled={saving === p.id} className="flex items-center gap-1 border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" /> 삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {products.length === 0 && <div className="text-center py-12 text-gray-400 text-sm bg-white border border-gray-200 rounded-2xl">등록된 상품이 없습니다. &quot;상품 추가&quot;로 등록하세요.</div>}
        </div>
      </div>
    </div>
  )
}
