import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { type, id, memo, existing } = await req.json()
  if (!type || !id || !memo?.trim()) {
    return NextResponse.json({ error: 'type, id, memo required' }, { status: 400 })
  }

  const now = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const newEntry = `[${now}] ${memo.trim()}`
  const updated = existing ? `${existing}\n${newEntry}` : newEntry

  if (type === 'quote') {
    const { error } = await supabaseAdmin.from('quotes').update({ admin_note: updated }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin.from('orders').update({ memo: updated }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated })
}
