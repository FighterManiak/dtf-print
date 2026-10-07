// 업체명 정규화 — (주)·주식회사·공백·대소문자 차이를 무시하고 같은 업체로 묶을 때 사용
// 업체별 주문 순위와 영업일지가 같은 기준으로 업체를 묶도록 여기에 둠
export function normCompany(name: string | null | undefined): string {
  return String(name || '')
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '')
    .replace(/[\s.,·-]/g, '')
    .toLowerCase()
}
