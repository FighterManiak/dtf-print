// 택배사별 배송조회 URL (클라이언트/서버 공용)
export function trackingUrl(carrier: string | null, tracking: string | null): string | null {
  if (!tracking) return null
  const c = (carrier || '').replace(/\s/g, '')
  const t = tracking.replace(/[^0-9a-zA-Z]/g, '')
  if (!t) return null
  if (/CJ|대한통운/i.test(c)) return `https://trace.cjlogistics.com/next/tracking.html?wblNo=${t}`
  if (/롯데/.test(c)) return `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${t}`
  if (/한진/.test(c)) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${t}`
  if (/우체국|우편/.test(c)) return `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${t}`
  if (/로젠/.test(c)) return `https://www.ilogen.com/web/personal/trace/${t}`
  if (/쿠팡/.test(c)) return `https://www.coupangls.com/delivery/${t}`
  // 알 수 없는 택배사는 통합 검색으로
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(`${c || '택배'} ${t}`)}`
}
