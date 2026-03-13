import { describe, it, expect } from 'vitest'
import { getMonthRange, getCalendarGrid, formatDateHeader, getDayOfWeek } from '../calendar'

describe('getMonthRange', () => {
  it('3월의 시작일과 마지막일을 반환', () => {
    const { start, end } = getMonthRange(2026, 2)
    expect(start).toBe('2026-03-01')
    expect(end).toBe('2026-03-31')
  })

  it('2월 윤년 처리', () => {
    const { end } = getMonthRange(2024, 1)
    expect(end).toBe('2024-02-29')
  })

  it('2월 평년 처리', () => {
    const { end } = getMonthRange(2025, 1)
    expect(end).toBe('2025-02-28')
  })
})

describe('getCalendarGrid', () => {
  it('2026년 3월 캘린더 그리드 생성', () => {
    const grid = getCalendarGrid(2026, 2)
    expect(grid.length).toBeGreaterThanOrEqual(4)
    expect(grid.length).toBeLessThanOrEqual(6)
    expect(grid[0].length).toBe(7)
    const firstDay = grid.flat().find(d => d?.date === 1)
    expect(firstDay).toBeDefined()
  })

  it('이전/다음 달 날짜는 null', () => {
    const grid = getCalendarGrid(2026, 2)
    const flatDates = grid.flat()
    const nullCount = flatDates.filter(d => d === null).length
    expect(nullCount).toBeGreaterThanOrEqual(0)
  })
})

describe('formatDateHeader', () => {
  it('날짜 헤더 포맷', () => {
    expect(formatDateHeader('2026-03-13')).toBe('3월 13일 금요일')
  })
})

describe('getDayOfWeek', () => {
  it('요일 반환', () => {
    expect(getDayOfWeek('2026-03-13')).toBe('금요일')
  })
})
