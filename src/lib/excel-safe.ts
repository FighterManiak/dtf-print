// 엑셀 수식 인젝션 방지
// 회원이 입력한 값(이름·회사명·메모 등)이 =, +, -, @ 로 시작하면
// 엑셀에서 수식으로 실행되므로, 앞에 작은따옴표를 붙여 텍스트로 강제한다.
const RISKY = /^[=+\-@\t\r]/

export function safeCell(v: unknown): unknown {
  if (typeof v !== 'string') return v
  return RISKY.test(v) ? `'${v}` : v
}

// 2차원 배열(행 목록) 전체를 안전하게 변환
export function safeRows<T extends unknown[]>(rows: T[]): unknown[][] {
  return rows.map((r) => r.map(safeCell))
}

// 주소에 "(02452) 서울 …" 형태로 들어있는 우편번호를 분리
export function splitAddress(full: string | null | undefined): { zip: string; addr: string } {
  const s = (full || '').trim()
  if (!s) return { zip: '', addr: '' }
  const m = s.match(/^\(?\s*(\d{5}|\d{3}-\d{3})\s*\)?\s*(.*)$/)
  if (m) return { zip: m[1].replace('-', ''), addr: m[2].trim() }
  return { zip: '', addr: s }
}
