// Supabase 연동 전 데모용 가상 계정
export const DEMO_USERS = {
  admin: {
    id: 'demo-admin-001',
    email: 'admin@dtfprint.com',
    password: 'admin1234!',
    user_metadata: {
      full_name: '관리자',
      role: 'admin',
    },
  },
  verified: {
    id: 'demo-verified-001',
    email: 'verified@dtfprint.com',
    password: 'verified1234!',
    user_metadata: {
      full_name: '인증고객',
      role: 'dtf_verified',
      phone: '010-1111-2222',
    },
  },
  normal: {
    id: 'demo-normal-001',
    email: 'user@dtfprint.com',
    password: 'user1234!',
    user_metadata: {
      full_name: '일반고객',
      role: 'user',
      phone: '010-3333-4444',
    },
  },
}

export type DemoUser = (typeof DEMO_USERS)[keyof typeof DEMO_USERS]

export function demoLogin(email: string, password: string): DemoUser | null {
  const user = Object.values(DEMO_USERS).find(
    (u) => u.email === email && u.password === password
  )
  return user ?? null
}

export function getDemoSession(): DemoUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('demo_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setDemoSession(user: DemoUser | null) {
  if (typeof window === 'undefined') return
  if (user) localStorage.setItem('demo_user', JSON.stringify(user))
  else localStorage.removeItem('demo_user')
}
