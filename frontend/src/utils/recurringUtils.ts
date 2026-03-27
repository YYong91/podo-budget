/**
 * @file recurringUtils.ts
 * @description 반복 거래 관련 순수 유틸 함수
 * RecurringList.tsx에서 추출한 주기 포맷 로직.
 */

interface RecurringFrequencyInput {
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom' | string
  day_of_month?: number | null
  day_of_week?: number | null
  month_of_year?: number | null
  interval?: number | null
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const

/**
 * 반복 거래의 주기를 한국어 문자열로 포맷한다.
 *
 * @example
 * formatFrequency({ frequency: 'monthly', day_of_month: 25 }) // "매월 25일"
 * formatFrequency({ frequency: 'weekly', day_of_week: 2 })    // "매주 수요일"
 * formatFrequency({ frequency: 'yearly', month_of_year: 3, day_of_month: 1 }) // "매년 3월 1일"
 * formatFrequency({ frequency: 'custom', interval: 14 })      // "14일마다"
 */
export function formatFrequency(r: RecurringFrequencyInput): string {
  switch (r.frequency) {
    case 'monthly':
      return `매월 ${r.day_of_month}일`
    case 'weekly':
      return `매주 ${DAY_NAMES[r.day_of_week ?? 0]}요일`
    case 'yearly':
      return `매년 ${r.month_of_year}월 ${r.day_of_month}일`
    case 'custom':
      return `${r.interval}일마다`
    default:
      return r.frequency
  }
}
