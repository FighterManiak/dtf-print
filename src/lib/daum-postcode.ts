// 카카오(다음) 우편번호 검색 스크립트 로더 + 실행 헬퍼
// 사용: const { zonecode, address } = await openPostcode()

const SCRIPT_SRC = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

interface PostcodeData {
  zonecode: string       // 5자리 우편번호
  roadAddress: string    // 도로명 주소
  jibunAddress: string   // 지번 주소
}

interface DaumPostcode {
  new (opts: { oncomplete: (data: PostcodeData) => void; onclose?: () => void }): { open: () => void }
}

declare global {
  interface Window {
    daum?: { Postcode: DaumPostcode }
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) return resolve()
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('우편번호 서비스 로드 실패'))
    document.head.appendChild(script)
  })
}

export async function openPostcode(): Promise<{ zonecode: string; address: string } | null> {
  await loadScript()
  return new Promise((resolve) => {
    let done = false
    new window.daum!.Postcode({
      oncomplete: (data) => {
        done = true
        resolve({ zonecode: data.zonecode, address: data.roadAddress || data.jibunAddress })
      },
      onclose: () => { if (!done) resolve(null) },
    }).open()
  })
}
