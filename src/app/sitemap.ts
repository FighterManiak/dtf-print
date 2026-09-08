import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600

const SITE = 'https://www.superhard.co.kr'

// 공개 페이지 사이트맵 (자재 상품 상세는 DB에서 자동 수집)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/order-select`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/order`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/quote/request`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/materials`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/grade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // 판매중인 자재 상품 상세페이지
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('materials')
      .select('id,updated_at,created_at')
      .eq('is_active', true)
      .limit(1000)

    const productPages: MetadataRoute.Sitemap = (data || []).map((m) => ({
      url: `${SITE}/materials/${m.id}`,
      lastModified: new Date((m.updated_at as string) || (m.created_at as string) || now),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
    return [...staticPages, ...productPages]
  } catch {
    return staticPages
  }
}
