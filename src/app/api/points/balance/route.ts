export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getAvailablePoints } from '@/lib/points-server'
import { POINT_USE_THRESHOLD } from '@/lib/grade'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const available = await getAvailablePoints(supabaseAdmin, user.id)
  return NextResponse.json({ available, usable: available >= POINT_USE_THRESHOLD, threshold: POINT_USE_THRESHOLD })
}
