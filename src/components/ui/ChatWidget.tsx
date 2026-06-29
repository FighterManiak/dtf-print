'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Image, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Message {
  id: string
  content: string | null
  image_url: string | null
  sender_type: 'user' | 'admin'
  created_at: string
}

interface GuestInfo {
  name: string
  email: string
  phone: string
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 비로그인 게스트 정보
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({ name: '', email: '', phone: '' })
  const [guestStep, setGuestStep] = useState<'form' | 'chat'>('form')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // localStorage에서 복원한 roomId를 ref로 보관 (state 타이밍 문제 방지)
  const savedRoomRef = useRef<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsLoggedIn(true)
        setUserId(user.id)
        setGuestInfo({ name: user.user_metadata?.full_name || user.email || '', email: user.email || '', phone: user.user_metadata?.phone || '' })
        setGuestStep('chat')
        const savedRoom = localStorage.getItem(`chat_room_id_${user.id}`)
        if (savedRoom) {
          savedRoomRef.current = savedRoom
          setRoomId(savedRoom)
        }
      } else {
        const saved = localStorage.getItem('chat_guest')
        const savedRoom = localStorage.getItem('chat_room_id')
        if (saved) {
          const parsed = JSON.parse(saved)
          setGuestInfo(parsed)
          setGuestStep('chat')
          if (savedRoom) {
            savedRoomRef.current = savedRoom
            setRoomId(savedRoom)
          }
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!open || guestStep !== 'chat') return
    // state 반영 전에도 ref에서 roomId 읽어서 사용
    const rid = roomId || savedRoomRef.current
    if (!rid) {
      initRoom()
    } else {
      if (!roomId) setRoomId(rid)
      loadMessages(rid)
    }
  }, [open, guestStep])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initRoom = async () => {
    const supabase = createClient()
    let rid = roomId

    if (!rid) {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          user_id: userId || null,
          user_email: guestInfo.email,
          user_name: guestInfo.name,
          user_phone: guestInfo.phone || null,
          status: 'open',
        })
        .select('id')
        .single()

      if (error) {
        console.error('채팅방 생성 실패:', error)
        alert(`채팅방 생성 실패: ${error.message}`)
        return
      }
      if (!newRoom) return
      rid = newRoom.id
      setRoomId(rid)
      savedRoomRef.current = rid
      if (isLoggedIn && userId) {
        localStorage.setItem(`chat_room_id_${userId}`, rid!)
      } else {
        localStorage.setItem('chat_guest', JSON.stringify(guestInfo))
        localStorage.setItem('chat_room_id', rid)
      }
    }

    if (!rid) return
    await loadMessages(rid)
    subscribeRoom(rid)
  }

  const loadMessages = async (rid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', rid)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    subscribeRoom(rid)
  }

  const subscribeRoom = (rid: string) => {
    const supabase = createClient()
    supabase
      .channel(`room-${rid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${rid}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === (payload.new as Message).id)
          if (exists) return prev
          return [...prev, payload.new as Message]
        })
      })
      .subscribe()
  }

  const sendMessage = async (content: string, imageUrl?: string) => {
    if (!roomId) return
    const supabase = createClient()
    const { data: newMsg } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: userId || null,
      sender_type: 'user',
      content: content || null,
      image_url: imageUrl || null,
    }).select().single()
    if (newMsg) setMessages((prev) => [...prev, newMsg as Message])
    await supabase.from('chat_rooms').update({
      last_message: content || '사진',
      last_message_at: new Date().toISOString(),
    }).eq('id', roomId)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    setLoading(true)
    await sendMessage(input.trim())
    setInput('')
    setLoading(false)
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `chat/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (error) {
      alert(`이미지 업로드 실패: ${error.message}`)
    } else {
      const { data } = supabase.storage.from('chat-images').getPublicUrl(path)
      await sendMessage('', data.publicUrl)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestInfo.name.trim() || !guestInfo.phone.trim() || !guestInfo.email.trim()) return
    setGuestStep('chat')
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden" style={{ height: guestStep === 'form' ? 'auto' : '520px' }}>
          {/* 헤더 */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <div className="font-bold text-sm">1:1 문의</div>
              <div className="text-xs text-blue-200">평균 응답시간 수 분 이내</div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-blue-700 p-1 rounded-lg transition-colors">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* 비로그인 정보 입력 폼 */}
          {guestStep === 'form' && (
            <form onSubmit={handleGuestSubmit} className="p-5 space-y-3">
              <p className="text-sm text-gray-600">문의하실 정보를 입력해주세요.</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">이름 *</label>
                <input
                  type="text"
                  value={guestInfo.name}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동"
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">전화번호 *</label>
                <input
                  type="tel"
                  value={guestInfo.phone}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  required
                  inputMode="numeric"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">이메일 *</label>
                <input
                  type="email"
                  value={guestInfo.email}
                  onChange={(e) => setGuestInfo((p) => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com"
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
              >
                문의 시작하기
              </button>
            </form>
          )}

          {/* 채팅 */}
          {guestStep === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    안녕하세요! 무엇이든 물어보세요 😊
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_type === 'admin' && (
                      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">S</div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      msg.sender_type === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                    }`}>
                      {msg.content && <p>{msg.content}</p>}
                      {msg.image_url && (
                        <img src={msg.image_url} alt="첨부이미지" className="rounded-lg max-w-full mt-1 cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} />
                      )}
                      <div className={`text-xs mt-1 ${msg.sender_type === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-gray-100 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-gray-400 hover:text-blue-500 transition-colors p-1 shrink-0">
                    <Image className="w-5 h-5" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={uploading ? '업로드 중...' : '메시지를 입력하세요'}
                    disabled={loading || uploading}
                    className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button onClick={handleSend} disabled={!input.trim() || loading} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
