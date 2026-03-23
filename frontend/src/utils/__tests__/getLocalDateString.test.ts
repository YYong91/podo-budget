import { describe, it, expect, vi, afterEach } from 'vitest'
import { getLocalDateString } from '../format'

describe('getLocalDateString', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('로컬 시간 기준 YYYY-MM-DD 반환', () => {
    // 2026-03-23 한국시간 기준
    const date = new Date(2026, 2, 23, 8, 30, 0) // month는 0-indexed
    expect(getLocalDateString(date)).toBe('2026-03-23')
  })

  it('UTC 자정 직후(한국 오전 9시 전)에도 한국 날짜 반환', () => {
    // 2026-03-23 00:30 UTC = 2026-03-23 09:30 KST
    // toISOString은 2026-03-23이지만, KST 기준으로도 23일
    const date = new Date(2026, 2, 23, 0, 30, 0)
    expect(getLocalDateString(date)).toBe('2026-03-23')
  })

  it('월과 일이 한 자리일 때 0-패딩', () => {
    const date = new Date(2026, 0, 5) // 1월 5일
    expect(getLocalDateString(date)).toBe('2026-01-05')
  })

  it('인자 없이 호출하면 오늘 날짜', () => {
    const result = getLocalDateString()
    // YYYY-MM-DD 형식 확인
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // 로컬 시간 기준 오늘 날짜와 일치
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(result).toBe(expected)
  })

  it('로컬 시간 기준으로 항상 올바른 날짜 반환', () => {
    // 2026-03-23 02:00 로컬 시간
    const date = new Date(2026, 2, 23, 2, 0, 0)
    const localDate = getLocalDateString(date)

    // 로컬은 항상 23일 (toISOString은 UTC 기준이라 다를 수 있음)
    expect(localDate).toBe('2026-03-23')
  })
})
