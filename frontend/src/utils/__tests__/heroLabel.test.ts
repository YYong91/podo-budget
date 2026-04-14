import { describe, it, expect } from 'vitest'
import { getHeroLabel } from '../heroLabel'

describe('getHeroLabel', () => {
  // ─── 예산 미설정 / 로딩 ───

  it('예산 로딩 중(undefined)이면 "이번 달 지출" 반환 (현재 달)', () => {
    expect(getHeroLabel(100000, undefined, 0, 4, true)).toBe('이번 달 지출')
  })

  it('예산 로딩 중(undefined)이면 "N월 지출" 반환 (과거 달)', () => {
    expect(getHeroLabel(100000, undefined, 0, 3, false)).toBe('3월 지출')
  })

  it('예산 미설정(null)이면 "이번 달 지출" 반환 (현재 달)', () => {
    expect(getHeroLabel(100000, null, 0, 4, true)).toBe('이번 달 지출')
  })

  it('예산 미설정(null)이면 "N월 지출" 반환 (과거 달)', () => {
    expect(getHeroLabel(100000, null, 0, 2, false)).toBe('2월 지출')
  })

  it('예산 0이면 "이번 달 지출" 반환 (현재 달)', () => {
    expect(getHeroLabel(0, 0, 0, 4, true)).toBe('이번 달 지출')
  })

  // ─── 실제 초과 ───

  it('지출이 예산을 초과하면 "예산을 넘었어요" (현재 달)', () => {
    expect(getHeroLabel(500000, 400000, 0, 4, true)).toBe('예산을 넘었어요')
  })

  it('지출이 예산을 초과하면 "예산을 넘었어요" (과거 달도 동일)', () => {
    expect(getHeroLabel(500000, 400000, 0, 3, false)).toBe('예산을 넘었어요')
  })

  // ─── 예상 초과 (정기지출 포함) ───

  it('정기지출 포함 시 예산 초과 예상이면 "예산 초과 직전이에요" (현재 달)', () => {
    // 지출 350,000 + 정기 100,000 = 450,000 > 예산 400,000
    expect(getHeroLabel(350000, 400000, 100000, 4, true)).toBe('예산 초과 직전이에요')
  })

  it('정기지출 포함 시 예산 초과 예상이어도 과거 달은 예측 메시지 표시 안 함', () => {
    expect(getHeroLabel(350000, 400000, 100000, 3, false)).toBe('3월 지출')
  })

  // ─── 지출 속도 빠름 (80%+) ───

  it('사용률 80% 이상이면 "지출 속도가 빨라요" (현재 달)', () => {
    // 320,000 / 400,000 = 80%
    expect(getHeroLabel(320000, 400000, 0, 4, true)).toBe('지출 속도가 빨라요')
  })

  it('사용률 80% 이상이어도 과거 달은 "N월 지출"', () => {
    expect(getHeroLabel(320000, 400000, 0, 3, false)).toBe('3월 지출')
  })

  // ─── 여유 (40% 미만) ───

  it('사용률 40% 미만이면 "여유 있는 한 달이에요" (현재 달)', () => {
    // 100,000 / 400,000 = 25%
    expect(getHeroLabel(100000, 400000, 0, 4, true)).toBe('여유 있는 한 달이에요')
  })

  it('사용률 40% 미만이면 "절약한 달이에요" (과거 달)', () => {
    expect(getHeroLabel(100000, 400000, 0, 3, false)).toBe('절약한 달이에요')
  })

  // ─── 정상 구간 (40~80%) ───

  it('사용률 40~80% 구간이면 "이번 달 지출" (현재 달)', () => {
    // 200,000 / 400,000 = 50%
    expect(getHeroLabel(200000, 400000, 0, 4, true)).toBe('이번 달 지출')
  })

  it('사용률 40~80% 구간이면 "N월 지출" (과거 달)', () => {
    expect(getHeroLabel(200000, 400000, 0, 3, false)).toBe('3월 지출')
  })

  // ─── 경계값 ───

  it('사용률 정확히 40%는 정상 구간으로 처리', () => {
    // 160,000 / 400,000 = 40%
    expect(getHeroLabel(160000, 400000, 0, 4, true)).toBe('이번 달 지출')
  })

  it('사용률 정확히 80%는 "지출 속도가 빨라요"', () => {
    // 320,000 / 400,000 = 80%
    expect(getHeroLabel(320000, 400000, 0, 4, true)).toBe('지출 속도가 빨라요')
  })

  it('정기지출이 없으면 예상 초과 체크하지 않음', () => {
    // 200,000 / 400,000 = 50% (정상 구간), pendingRecurring=0 → 예상 초과 미발동
    expect(getHeroLabel(200000, 400000, 0, 4, true)).toBe('이번 달 지출')
  })
})
