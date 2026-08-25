export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// 스윗트래커(굿스플로) 택배사 코드
const CARRIER_CODE: { match: RegExp; code: string; name: string }[] = [
  { match: /CJ|대한통운/i, code: '04', name: 'CJ대한통운' },
  { match: /롯데/, code: '08', name: '롯데택배' },
  { match: /한진/, code: '05', name: '한진택배' },
  { match: /우체국|우편/, code: '01', name: '우체국택배' },
  { match: /로젠/, code: '06', name: '로젠택배' },
  { match: /쿠팡/, code: '41', name: '쿠팡로지스틱스' },
  { match: /경동/, code: '23', name: '경동택배' },
  { match: /대신/, code: '22', name: '대신택배' },
  { match: /일양/, code: '11', name: '일양로지스' },
  { match: /천일/, code: '53', name: '천일택배' },
  { match: /GS|편의점/i, code: '46', name: 'GS Postbox' },
  { match: /CU|씨유/i, code: '46', name: 'CU 편의점택배' },
]

function resolveCarrier(carrier: string | null) {
  const c = (carrier || '').replace(/\s/g, '')
  return CARRIER_CODE.find((x) => x.match.test(c)) || null
}

// 실시간 배송조회 (스윗트래커 API)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const carrier = url.searchParams.get('carrier')
  const invoice = (url.searchParams.get('invoice') || '').replace(/[^0-9a-zA-Z]/g, '')

  if (!invoice) return NextResponse.json({ error: '송장번호가 없습니다.' }, { status: 400 })

  const apiKey = process.env.SWEET_TRACKER_API_KEY
  const found = resolveCarrier(carrier)

  if (!apiKey) {
    return NextResponse.json({ available: false, reason: 'API 키 미설정', carrierName: found?.name || carrier, invoice })
  }
  if (!found) {
    return NextResponse.json({ available: false, reason: '지원하지 않는 택배사', carrierName: carrier, invoice })
  }

  try {
    const res = await fetch(
      `http://info.sweettracker.co.kr/api/v1/trackingInfo?t_key=${apiKey}&t_code=${found.code}&t_invoice=${invoice}`,
      { cache: 'no-store' }
    )
    const d = await res.json()

    if (d?.status === false || d?.code) {
      return NextResponse.json({ available: false, reason: d?.msg || '배송 정보를 찾을 수 없습니다.', carrierName: found.name, invoice })
    }

    interface Detail { timeString?: string; where?: string; kind?: string; telno?: string }
    const details = (d?.trackingDetails || []) as Detail[]

    return NextResponse.json({
      available: true,
      carrierName: found.name,
      invoice,
      completed: !!d?.complete,
      senderName: d?.senderName || null,
      receiverName: d?.receiverName || null,
      itemName: d?.itemName || null,
      lastStatus: d?.lastStateDetail?.kind || details[details.length - 1]?.kind || null,
      lastTime: d?.lastStateDetail?.timeString || details[details.length - 1]?.timeString || null,
      steps: details.map((t) => ({
        time: t.timeString || '',
        where: t.where || '',
        kind: t.kind || '',
        tel: t.telno || '',
      })),
    })
  } catch {
    return NextResponse.json({ available: false, reason: '조회 중 오류가 발생했습니다.', carrierName: found.name, invoice })
  }
}
