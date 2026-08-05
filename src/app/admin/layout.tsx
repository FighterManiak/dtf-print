import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

// 관리자 영역 접근 제어 — 로그인 + 관리자/최고관리자만 허용
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role
  if (!user) {
    redirect('/login?redirect=/admin')
  }
  if (role !== 'admin' && role !== 'superadmin') {
    redirect('/')
  }

  return <>{children}</>
}
