/**
 * 월 계산 유틸리티
 * - "YYYY-MM" 문자열 기반으로 이전/다음 월 계산
 * - KST(UTC+9) 기준 현재 월 조회
 */

// KST는 UTC+9 — 서버 타임존과 무관하게 한국 기준 시간을 계산할 때 사용
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 주어진 월의 이전 월을 반환한다.
 * 1월이면 전년도 12월로 감소한다.
 * @example prevMonth("2026-03") → "2026-02"
 * @example prevMonth("2026-01") → "2025-12"
 */
export function prevMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-')
  let year = parseInt(yearStr, 10)
  let m = parseInt(monthStr, 10)

  m -= 1
  // 1월에서 감소하면 전년도 12월
  if (m < 1) {
    m = 12
    year -= 1
  }

  return `${year}-${String(m).padStart(2, '0')}`
}

/**
 * 주어진 월의 다음 월을 반환한다.
 * 12월이면 다음 연도 1월로 증가한다.
 * @example nextMonth("2026-03") → "2026-04"
 * @example nextMonth("2025-12") → "2026-01"
 */
export function nextMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-')
  let year = parseInt(yearStr, 10)
  let m = parseInt(monthStr, 10)

  m += 1
  // 12월에서 증가하면 다음 연도 1월
  if (m > 12) {
    m = 1
    year += 1
  }

  return `${year}-${String(m).padStart(2, '0')}`
}

/**
 * KST(UTC+9) 기준 현재 월을 "YYYY-MM" 형식으로 반환한다.
 * 서버 타임존과 무관하게 한국 기준 월을 보장한다.
 */
export function currentMonthKst(): string {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS)

  // UTC 기준으로 KST 날짜를 구한 뒤 연월 추출
  const year = nowKst.getUTCFullYear()
  const month = nowKst.getUTCMonth() + 1 // getUTCMonth()는 0-indexed

  return `${year}-${String(month).padStart(2, '0')}`
}
