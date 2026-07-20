export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// DTF 인증 승인/반려 — 상태·이력 기록 + 회원 메타데이터 반영
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { verificationId, userId, action, rejectReason } = await req.json()
  if (!verificationId || !userId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const admin = getAdminClient()
  const approved = action === 'approve'
  const now = new Date().toISOString()

  // 인증 신청 상태 + 처리 이력 기록
  const { error: vErr } = await admin
    .from('dtf_verifications')
    .update({
      status: approved ? 'approved' : 'rejected',
      reviewed_at: now,
      reviewed_by: user?.email || null,
      reject_reason: approved ? null : (rejectReason || '').trim() || null,
    })
    .eq('id', verificationId)
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // 회원 메타데이터 반영 (승인 시 인증 회원으로 전환)
  const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { verify_status: approved ? 'approved' : 'rejected' },
  })
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
