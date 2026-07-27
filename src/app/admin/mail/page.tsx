'use client'

import { useEffect, useState } from 'react'
import { Mail, Send, Users, ShieldCheck, FlaskConical } from 'lucide-react'

type Scope = 'all' | 'verified' | 'test'

const SCOPES: { key: Scope; label: string; desc: string; icon: typeof Users }[] = [
  { key: 'all', label: '전체 회원', desc: '인증 완료·탈퇴하지 않은 모든 회원', icon: Users },
  { key: 'verified', label: 'DTF 인증 회원', desc: 'DTF 장비 보유인증 완료 회원만', icon: ShieldCheck },
  { key: 'test', label: '테스트 발송', desc: '내 이메일로만 발송 (미리 확인용)', icon: FlaskConical },
]

export default function AdminMailPage() {
  const [scope, setScope] = useState<Scope>('test')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setCount(null)
    fetch(`/api/admin/send-mail?scope=${scope}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && typeof d.count === 'number') setCount(d.count) })
      .catch(() => {})
  }, [scope])

  const send = async () => {
    setError('')
    setResult(null)
    if (!subject.trim() || !body.trim()) { setError('제목과 내용을 입력해주세요.'); return }
    const label = SCOPES.find((s) => s.key === scope)?.label
    if (!confirm(`[${label}]${count != null ? ` 약 ${count}명에게` : ''} 메일을 발송하시겠습니까?`)) return
    setSending(true)
    const res = await fetch('/api/admin/send-mail', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, scope }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setResult(`발송 완료 — ${d.sent}명에게 전송했습니다.`)
    } else {
      setError(d.error || '발송에 실패했습니다.')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-900">회원 메일 발송</h1>
        </div>

        {/* 수신 대상 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-3">수신 대상</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SCOPES.map(({ key, label, desc, icon: Icon }) => (
              <button key={key} onClick={() => setScope(key)}
                className={`text-left rounded-xl p-3 border-2 transition-colors ${scope === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-4 h-4 ${scope === key ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${scope === key ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            예상 수신 인원: <b className="text-gray-800">{count == null ? '계산 중...' : `${count.toLocaleString()}명`}</b>
          </p>
        </div>

        {/* 작성 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <label className="text-sm font-bold text-gray-700 block mb-1.5">제목</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="예) SUPER HARD 8월 정식 오픈 안내"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400" />

          <label className="text-sm font-bold text-gray-700 block mb-1.5">내용</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
            placeholder="안녕하세요, SUPER HARD입니다.&#10;&#10;내용을 입력하세요. 줄바꿈은 그대로 반영됩니다."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed" />
          <p className="text-xs text-gray-400 mt-1.5">* 자동으로 SUPER HARD 브랜드 디자인과 수신거부 안내가 포함되어 발송됩니다.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
        {result && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">{result}</div>}

        {/* 발송 */}
        <button onClick={send} disabled={sending}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          {sending ? '발송 중...' : scope === 'test' ? '테스트 발송하기' : '회원에게 발송하기'}
        </button>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-4 text-xs text-amber-800 leading-relaxed">
          <b>⚠️ 발송 전 확인</b><br />
          · 처음엔 반드시 <b>테스트 발송</b>으로 본인 메일에서 확인 후 전체 발송하세요.<br />
          · 광고성 메일은 제목에 <b>(광고)</b> 표기와 수신거부 안내가 필요합니다. (단순 공지는 제외)<br />
          · Resend 무료 플랜은 하루 100건 제한이 있어, 회원이 많으면 나눠 보내야 할 수 있어요.
        </div>
      </div>
    </div>
  )
}
