import { describe, it, expect } from 'vitest'
import { formatCompactAmount } from '../format'

describe('formatCompactAmount', () => {
  it('1만 미만은 그대로 표시', () => {
    expect(formatCompactAmount(8000)).toBe('8,000')
    expect(formatCompactAmount(500)).toBe('500')
    expect(formatCompactAmount(9999)).toBe('9,999')
  })

  it('1만 이상 100만 미만은 만 단위', () => {
    expect(formatCompactAmount(10000)).toBe('1만')
    expect(formatCompactAmount(15000)).toBe('1.5만')
    expect(formatCompactAmount(123000)).toBe('12.3만')
    expect(formatCompactAmount(999000)).toBe('99.9만')
  })

  it('100만 이상은 백만 단위', () => {
    expect(formatCompactAmount(1000000)).toBe('100만')
    expect(formatCompactAmount(1500000)).toBe('150만')
    expect(formatCompactAmount(3500000)).toBe('350만')
  })

  it('소수점 불필요 시 제거', () => {
    expect(formatCompactAmount(20000)).toBe('2만')
    expect(formatCompactAmount(3000000)).toBe('300만')
  })
})
