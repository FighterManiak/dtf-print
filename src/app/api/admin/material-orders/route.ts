export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role
  if (role !== 'admin' && role !== 'superadmin') return null
  return { user, role }
}

// 관리자: 자재 주문 전체 조회
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data, error } = await supabaseAdmin
    .from('material_orders').select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// 관리자: 상태·송장·입금여부·메모 변경
export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (b.status !== undefined) patch.status = b.status
  if (b.carrier !== undefined) patch.carrier = String(b.carrier || '').trim() || null
  if (b.trackingNumber !== undefined) patch.tracking_number = String(b.trackingNumber || '').trim() || null
  if (b.isPaid !== undefined) patch.is_paid = !!b.isPaid
  if (b.memo !== undefined) patch.memo = String(b.memo || '').trim() || null

  const { error } = await supabaseAdmin.from('material_orders').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 관리자: 자재 주문 삭제 (감사 로그 기록)
export async function DELETE(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const reason = url.searchParams.get('reason') || ''
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })

  const { data: order } = await supabaseAdmin.from('material_orders').select('*').eq('id', id).single()
  if (order) {
    try {
      await supabaseAdmin.from('deleted_orders').insert({
        kind: 'material',
        record_id: id,
        user_name: order.user_name, user_phone: order.user_phone, user_email: order.user_email,
        total_amount: order.total_amount, status: order.status, is_paid: order.is_paid ?? null,
        order_name: order.order_name, memo: order.memo, original_created_at: order.created_at,
        snapshot: order,
        deleted_by: auth.user?.email || null,
        deleted_by_role: auth.role,
        reason: reason.trim() || null,
      })
    } catch { /* 로그 실패해도 삭제는 진행 */ }
  }

  const { error } = await supabaseAdmin.from('material_orders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
