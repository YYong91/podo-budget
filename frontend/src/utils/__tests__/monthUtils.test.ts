import { describe, it, expect } from 'vitest'
import { prevMonth, nextMonth, currentMonthKst } from '../monthUtils'

describe('prevMonth', () => {
  it('일반 월은 전월을 반환한다', () => {
    expect(prevMonth('2026-03')).toBe('2026-02')
    expect(prevMonth('2026-06')).toBe('2026-05')
    expect(prevMonth('2026-12')).toBe('2026-11')
  })

  it('1월이면 전년도 12월을 반환한다', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
    expect(prevMonth('2000-01')).toBe('1999-12')
  })
})

describe('nextMonth', () => {
  it('일반 월은 다음 월을 반환한다', () => {
    expect(nextMonth('2026-03')).toBe('2026-04')
    expect(nextMonth('2026-01')).toBe('2026-02')
    expect(nextMonth('2026-11')).toBe('2026-12')
  })

  it('12월이면 다음 연도 1월을 반환한다', () => {
    expect(nextMonth('2025-12')).toBe('2026-01')
    expect(nextMonth('1999-12')).toBe('2000-01')
  })
})

describe('currentMonthKst', () => {
  it('YYYY-MM 형식으로 반환한다', () => {
    const result = currentMonthKst()
    expect(result).toMatch(/^\d{4}-\d{2}$/)
  })
})
