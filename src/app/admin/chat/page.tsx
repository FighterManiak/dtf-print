'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Image, CheckCircle, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface Room {
  id: string
  user_email: string
  user_name: string
  user_phone: string | null
  last_message: string | null
  last_message_at: string
  status: string
}

interface Message {
  id: string
  content: string | null
  image_url: string | null
  sender_type: 'user' | 'admin'
  created_at: string
}

export default function AdminChatPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const roomsChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    loadRooms()
    const supabase = createClient()
    const ch = supabase.channel('admin-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => loadRooms())
      .subscribe()
    roomsChannelRef.current = ch

    return () => {
      supabase.removeChannel(ch)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadRooms = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('last_message_at', { ascending: false })
    setRooms(data || [])
  }

  const selectRoom = async (room: Room) => {
    setSelectedRoom(room)
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    const ch = supabase
      .channel(`admin-room-${room.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === (payload.new as Message).id)
          if (exists) return prev
          return [...prev, payload.new as Message]
        })
      })
      .subscribe()
    channelRef.current = ch
  }

  const sendMessage = async (content: string, imageUrl?: string) => {
    if (!selectedRoom) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newMsg } = await supabase.from('chat_messages').insert({
      room_id: selectedRoom.id,
      sender_id: user?.id,
      sender_type: 'admin',
      content: content || null,
      image_url: imageUrl || null,
    }).select().single()
    if (newMsg) setMessages((prev) => [...prev, newMsg as Message])
    await supabase.from('chat_rooms').update({
      last_message: content || '사진',
      last_message_at: new Date().toISOString(),
    }).eq('id', selectedRoom.id)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    await sendMessage(input.trim())
    setInput('')
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `admin/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
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

  const closeRoom = async () => {
    if (!selectedRoom) return
    const supabase = createClient()
    await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', selectedRoom.id)
    setSelectedRoom({ ...selectedRoom, status: 'closed' })
    await loadRooms()
  }

  const reopenRoom = async () => {
    if (!selectedRoom) return
    const supabase = createClient()
    await supabase.from('chat_rooms').update({ status: 'open' }).eq('id', selectedRoom.id)
    setSelectedRoom({ ...selectedRoom, status: 'open' })
    await loadRooms()
  }

  const openRooms = rooms.filter((r) => r.status === 'open')
  const closedRooms = rooms.filter((r) => r.status === 'closed')
  const displayRooms = tab === 'open' ? openRooms : closedRooms

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* 채팅방 목록 */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('open')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'open' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            진행중 ({openRooms.length})
          </button>
          <button
            onClick={() => setTab('closed')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'closed' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            완료 ({closedRooms.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayRooms.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">
              {tab === 'open' ? '진행중인 문의가 없습니다.' : '완료된 문의가 없습니다.'}
            </div>
          )}
          {displayRooms.map((room) => (
            <div
              key={room.id}
              className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedRoom?.id === room.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
            >
              <button
                onClick={() => selectRoom(room)}
                className="flex-1 text-left px-4 py-3 min-w-0"
              >
                <div className="font-medium text-gray-800 text-sm truncate">{room.user_name || room.user_email}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{room.last_message || '새 문의'}</div>
                <div className="text-xs text-gray-300 mt-0.5">
                  {new Date(room.last_message_at).toLocaleDateString('ko-KR')}
                  {' '}
                  {new Date(room.last_message_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
              {room.status === 'open' && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    const supabase = createClient()
                    await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', room.id)
                    if (selectedRoom?.id === room.id) setSelectedRoom({ ...room, status: 'closed' })
                    await loadRooms()
                  }}
                  className="shrink-0 mr-2 p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                  title="문의 완료"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 채팅 내용 */}
      {selectedRoom ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* 채팅 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-800">{selectedRoom.user_name || selectedRoom.user_email}</div>
              <div className="text-sm text-gray-400">{selectedRoom.user_email}{selectedRoom.user_phone ? ` · ${selectedRoom.user_phone}` : ''}</div>
            </div>
            {selectedRoom.status === 'open' ? (
              <button
                onClick={closeRoom}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                문의 완료
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">완료된 문의</span>
                <button
                  onClick={reopenRoom}
                  className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  재오픈
                </button>
              </div>
            )}
          </div>

          {/* 메시지 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender_type === 'user' && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">
                    {(selectedRoom.user_name || selectedRoom.user_email)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className={`max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                  msg.sender_type === 'admin'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}>
                  {msg.content && <p>{msg.content}</p>}
                  {msg.image_url && (
                    <img src={msg.image_url} alt="첨부이미지" className="rounded-lg max-w-xs mt-1 cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} />
                  )}
                  <div className={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 - 완료된 문의는 비활성화 */}
          <div className={`p-4 bg-white border-t border-gray-200 ${selectedRoom.status === 'closed' ? 'opacity-50 pointer-events-none' : ''}`}>
            {selectedRoom.status === 'closed' && (
              <p className="text-center text-sm text-gray-400 mb-2">완료된 문의입니다. 재오픈 후 답변 가능합니다.</p>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                <Image className="w-5 h-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={uploading ? '업로드 중...' : '답변을 입력하세요'}
                className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={handleSend} disabled={!input.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          왼쪽에서 채팅방을 선택하세요
        </div>
      )}
    </div>
  )
}
