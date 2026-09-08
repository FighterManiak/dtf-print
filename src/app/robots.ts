import type { MetadataRoute } from 'next'

const SITE = 'https://www.superhard.co.kr'

// 검색엔진 수집 규칙 — 관리자/API/개인 페이지는 색인 제외
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/my-quotes',
          '/my-materials',
          '/my-points',
          '/profile',
          '/chat',
          '/payment/',
          '/quote/success',
          '/login',
          '/signup',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
