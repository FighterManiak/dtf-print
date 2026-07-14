import crypto from 'crypto'

// 추천인 코드: 유저 ID에서 결정적으로 생성 (저장 불필요, 항상 동일)
// 형식: SH + 6자리 영숫자 (예: SH3F7K2A)
export function referralCodeFromUserId(userId: string): string {
  const hash = crypto.createHash('sha256').update(userId).digest('hex')
  return 'SH' + hash.slice(0, 6).toUpperCase()
}

// 추천인 보상 금액
export const REFERRER_REWARD = 5000   // 추천인 (기존 회원)
export const REFEREE_REWARD = 3000    // 피추천인 (신규 회원)
