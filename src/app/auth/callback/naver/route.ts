import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=naver_no_code`)
  }

  // 네이버 액세스 토큰 교환
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      code,
      state: searchParams.get('state') ?? '',
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${origin}/login?error=naver_token_failed`)
  }

  // 네이버 사용자 정보 조회
  const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const profileData = await profileRes.json()
  const naverUser = profileData.response

  if (!naverUser?.email) {
    return NextResponse.redirect(`${origin}/login?error=naver_no_email`)
  }

  // Supabase Admin으로 사용자 생성/로그인
  const { createClient } = await import('@supabase/supabase-js')
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 이미 가입된 유저인지 확인
  const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === naverUser.email)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // 신규 유저 생성
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: naverUser.email,
      email_confirm: true,
      user_metadata: {
        full_name: naverUser.name,
        avatar_url: naverUser.profile_image,
        provider: 'naver',
        naver_id: naverUser.id,
      },
    })
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=naver_create_failed`)
    }
    userId = data.user.id
  }

  // 매직 링크 대신 OTP로 세션 생성
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: naverUser.email,
  })

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/login?error=naver_session_failed`)
  }

  // 생성된 링크를 통해 세션 설정 후 리디렉션
  const magicUrl = new URL(linkData.properties.action_link)
  magicUrl.searchParams.set('next', next)

  return NextResponse.redirect(magicUrl.toString())
}
