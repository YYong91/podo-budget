/**
 * @file recurringUtils.test.ts
 * @description recurringUtils 순수 함수 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { formatFrequency } from '../recurringUtils'

describe('formatFrequency', () => {
  it('monthly: 매월 N일', () => {
    expect(formatFrequency({ frequency: 'monthly', day_of_month: 25 })).toBe('매월 25일')
    expect(formatFrequency({ frequency: 'monthly', day_of_month: 1 })).toBe('매월 1일')
  })

  it('weekly: 매주 X요일', () => {
    expect(formatFrequency({ frequency: 'weekly', day_of_week: 0 })).toBe('매주 월요일')
    expect(formatFrequency({ frequency: 'weekly', day_of_week: 4 })).toBe('매주 금요일')
    expect(formatFrequency({ frequency: 'weekly', day_of_week: 6 })).toBe('매주 일요일')
  })

  it('weekly: day_of_week 없으면 기본값 월요일', () => {
    expect(formatFrequency({ frequency: 'weekly' })).toBe('매주 월요일')
  })

  it('yearly: 매년 M월 D일', () => {
    expect(formatFrequency({ frequency: 'yearly', month_of_year: 3, day_of_month: 1 })).toBe('매년 3월 1일')
    expect(formatFrequency({ frequency: 'yearly', month_of_year: 12, day_of_month: 25 })).toBe('매년 12월 25일')
  })

  it('custom: N일마다', () => {
    expect(formatFrequency({ frequency: 'custom', interval: 14 })).toBe('14일마다')
    expect(formatFrequency({ frequency: 'custom', interval: 7 })).toBe('7일마다')
  })

  it('알 수 없는 빈도는 그대로 반환', () => {
    expect(formatFrequency({ frequency: 'biweekly' })).toBe('biweekly')
  })
})
