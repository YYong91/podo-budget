import { describe, it, expect } from 'vitest'
import { formatAmount, formatAmountWithSign, formatCompactAmount, maskUsername } from '../format'

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

describe('formatAmount', () => {
  it('₩ 기호와 쉼표 형식으로 포맷한다', () => {
    expect(formatAmount(8000)).toBe('₩8,000')
    expect(formatAmount(1000000)).toBe('₩1,000,000')
    expect(formatAmount(0)).toBe('₩0')
  })

  it('소수점은 반올림하여 표시한다', () => {
    expect(formatAmount(8000.7)).toBe('₩8,001')
    expect(formatAmount(8000.3)).toBe('₩8,000')
  })

  it('음수 금액도 포맷한다', () => {
    expect(formatAmount(-5000)).toBe('₩-5,000')
  })
})

describe('formatAmountWithSign', () => {
  it('수입(income)이면 + 접두사를 추가한다', () => {
    expect(formatAmountWithSign(50000, 'income')).toBe('+₩50,000')
    expect(formatAmountWithSign(0, 'income')).toBe('+₩0')
  })

  it('지출(expense)이면 접두사 없이 표시한다', () => {
    expect(formatAmountWithSign(8000, 'expense')).toBe('₩8,000')
    expect(formatAmountWithSign(100000, 'expense')).toBe('₩100,000')
  })
})

describe('maskUsername', () => {
  it('빈 문자열이나 1자 이하는 그대로 반환한다', () => {
    expect(maskUsername('')).toBe('')
    expect(maskUsername('A')).toBe('A')
  })

  it('카카오 봇 유저를 마스킹한다', () => {
    expect(maskUsername('kakao_5f2a8b')).toBe('카카오(5f**)')
  })

  it('텔레그램 봇 유저를 마스킹한다', () => {
    expect(maskUsername('telegram_123456')).toBe('텔레그램(12**)')
  })

  it('일반 유저(한글)를 마스킹한다', () => {
    expect(maskUsername('김수연')).toBe('김**')
  })

  it('일반 유저(영문)를 마스킹한다', () => {
    expect(maskUsername('John')).toBe('J**')
  })

  it('2자 이름은 첫 글자 + *', () => {
    expect(maskUsername('ab')).toBe('a*')
  })
})
