import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE = 'https://www.superhard.co.kr'

// 상품별 제목·설명·썸네일을 검색결과와 공유 미리보기에 반영
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: m } = await supabase
      .from('materials')
      .select('name,description,detail,price,images,is_active')
      .eq('id', id)
      .single()

    if (!m) return { title: '자재 구매' }

    const desc =
      (m.description as string) ||
      ((m.detail as string) || '').slice(0, 120) ||
      `${m.name} — DTF 자재를 SUPER HARD에서 구매하세요.`

    const firstImage = Array.isArray(m.images) && m.images[0]
      ? supabase.storage.from('material-images').getPublicUrl(m.images[0] as string).data.publicUrl
      : undefined

    return {
      title: m.name as string,
      description: `${desc} · ${Number(m.price || 0).toLocaleString()}원`,
      alternates: { canonical: `/materials/${id}` },
      robots: m.is_active ? undefined : { index: false, follow: true },
      openGraph: {
        type: 'website',
        url: `${SITE}/materials/${id}`,
        title: `${m.name} | SUPER HARD`,
        description: desc,
        images: firstImage ? [{ url: firstImage }] : undefined,
      },
    }
  } catch {
    return { title: '자재 구매' }
  }
}

export default function MaterialDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
