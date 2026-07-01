import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024 // 1GB (Supabase 무료 플랜)

async function listAllFiles(bucket: string, folder = ''): Promise<number> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
    limit: 1000,
    offset: 0,
  })
  if (error || !data) return 0

  let total = 0
  for (const item of data) {
    if (item.metadata?.size) {
      total += item.metadata.size
    } else if (!item.metadata) {
      // 폴더인 경우 재귀 탐색
      const path = folder ? `${folder}/${item.name}` : item.name
      total += await listAllFiles(bucket, path)
    }
  }
  return total
}

export async function GET() {
  try {
    // 사용 중인 버킷 목록
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketNames = (buckets || []).map((b) => b.name)

    const bucketStats: { name: string; size: number }[] = []
    let totalUsed = 0

    for (const name of bucketNames) {
      const size = await listAllFiles(name)
      bucketStats.push({ name, size })
      totalUsed += size
    }

    return NextResponse.json({
      totalUsed,
      totalLimit: STORAGE_LIMIT_BYTES,
      usedPercent: Math.round((totalUsed / STORAGE_LIMIT_BYTES) * 100 * 10) / 10,
      buckets: bucketStats,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
