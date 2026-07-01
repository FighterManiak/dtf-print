import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { quoteId, status } = await req.json()

  if (!quoteId || !status) {
    return NextResponse.json({ error: 'quoteId and status required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .update({ status })
    .eq('id', quoteId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: `quote not found: ${quoteId}` }, { status: 404 })

  return NextResponse.json({ success: true })
}
