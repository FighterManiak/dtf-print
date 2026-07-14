export const dynamic = 'force-dynamic'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { referralCodeFromUserId, REFERRER_REWARD, REFEREE_REWARD } from '@/lib/referral'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const code = referralCodeFromUserId(user.id)
  const link = `https://www.superhard.co.kr/login?ref=${code}`
  return NextResponse.json({ code, link, referrerReward: REFERRER_REWARD, refereeReward: REFEREE_REWARD })
}
