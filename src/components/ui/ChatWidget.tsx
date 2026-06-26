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

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) return
      setUser({ id: u.id, email: u.email || '', name: u.user_metadata?.full_name || u.email || '' })
    }
    init()
  }, [])

  useEffect(() => {
    if (!open || !user) return
    initRoom()
  }, [open, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initRoom = async () => {
    const supabase = createClient()
    let { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('user_id', user!.id)
      .single()

    if (!room) {
      const { data: newRoom } = await supabase
        .from('chat_rooms')
        .insert({ user_id: user!.id, user_email: user!.email, user_name: user!.name })
        .select('id')
        .single()
      room = newRoom
    }

    if (!room) return
    setRoomId(room.id)

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    // 실시간 구독
    supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()
  }

  const sendMessage = async (content: string, imageUrl?: string) => {
    if (!roomId || !user) return
    const supabase = createClient()
    const { data: newMsg } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: user.id,
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
    if (!file || !user) return
    setUploading(true)
    const supabase = createClient()
    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('chat-images').getPublicUrl(path)
      await sendMessage('', data.publicUrl)
    }
    setUploading(false)
    e.target.value = ''
  }

  if (!user) return null

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* 채팅 창 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden">
          {/* 헤더 */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm">1:1 문의</div>
              <div className="text-xs text-blue-200">평균 응답시간 수 분 이내</div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-blue-700 p-1 rounded-lg transition-colors">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* 메시지 목록 */}
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
                    <img
                      src={msg.image_url}
                      alt="첨부이미지"
                      className="rounded-lg max-w-full mt-1 cursor-pointer"
                      onClick={() => window.open(msg.image_url!, '_blank')}
                    />
                  )}
                  <div className={`text-xs mt-1 ${msg.sender_type === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-gray-400 hover:text-blue-500 transition-colors p-1 shrink-0"
              >
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
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
