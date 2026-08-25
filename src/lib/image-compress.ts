// 업로드 전 이미지 리사이즈·압축 (브라우저에서 처리)
// 채팅 사진처럼 원본 화질이 필요 없는 첨부에 사용

interface CompressOptions {
  maxWidth?: number   // 최대 가로 (px)
  maxHeight?: number  // 최대 세로 (px)
  quality?: number    // JPEG 품질 0~1
  maxBytes?: number   // 이 크기 이하면 압축 생략
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  maxBytes: 300 * 1024, // 300KB 이하는 그대로 사용
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const o = { ...DEFAULTS, ...opts }

  // 이미지가 아니거나 이미 충분히 작으면 원본 그대로
  if (!file.type.startsWith('image/')) return file
  if (file.size <= o.maxBytes) return file
  // GIF는 애니메이션이 깨지므로 제외
  if (file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, o.maxWidth / bitmap.width, o.maxHeight / bitmap.height)
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', o.quality)
    )
    if (!blob || blob.size >= file.size) return file // 압축 효과 없으면 원본

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file // 실패 시 원본 업로드
  }
}
