import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../healthScore'

describe('calculateHealthScore', () => {
  it('저축률 36%이면 savings 점수가 높다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      budgetTotal: 4000000,
      budgetSpent: 3200000,
      totalLiabilities: 0,
      totalAssets: 10000000,
      avgLoanRate: 0,
    })
    expect(score.savings).toBeGreaterThanOrEqual(80)
    expect(score.grade).toMatch(/^[AB]/)
  })

  it('수입이 0이면 저축률 점수 0', () => {
    const score = calculateHealthScore({
      incomeTotal: 0,
      expenseTotal: 0,
    })
    expect(score.savings).toBe(0)
    expect(score.overall).toBeGreaterThanOrEqual(0)
  })

  it('예산 초과 시 spending 점수가 낮다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 5500000,
      budgetTotal: 4000000,
      budgetSpent: 5500000,
    })
    expect(score.spending).toBeLessThan(50)
  })

  it('부채 비율 높으면 debt 점수가 낮다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3000000,
      totalLiabilities: 100000000,
      totalAssets: 50000000,
      avgLoanRate: 8,
    })
    expect(score.debt).toBeLessThan(50)
  })

  it('grade 범위가 A+~F 사이다', () => {
    const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
    const score = calculateHealthScore({
      incomeTotal: 3000000,
      expenseTotal: 2000000,
    })
    expect(grades).toContain(score.grade)
  })

  it('spending: 예산 사용률 80% 구간 경계 (정확히 80%) → 100점', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      budgetTotal: 4000000,
      budgetSpent: 3200000, // 80% 정확히
    })
    expect(score.spending).toBe(100)
  })

  it('spending: 예산 사용률 90% 구간 → 75점 부근', () => {
    // usageRate = 0.9 → 100 - (0.9 - 0.8) * 250 = 75
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3600000,
      budgetTotal: 4000000,
      budgetSpent: 3600000, // 90%
    })
    expect(score.spending).toBe(75)
  })

  it('spending: 예산 사용률 100% 구간 경계 → 50점', () => {
    // usageRate = 1.0 → 100 - (1.0 - 0.8) * 250 = 50
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 4000000,
      budgetTotal: 4000000,
      budgetSpent: 4000000, // 100%
    })
    expect(score.spending).toBe(50)
  })

  it('totalAssets=0이어도 부채 점수를 계산한다 (부채비율 2 적용)', () => {
    // totalAssets=0이면 debtRatio=2 → ratioScore=20
    const score = calculateHealthScore({
      incomeTotal: 3000000,
      expenseTotal: 2000000,
      totalLiabilities: 10000000,
      totalAssets: 0,
      avgLoanRate: 0,
    })
    // ratioScore=20, rateScore=100 → debt = 20*0.6 + 100*0.4 = 52
    expect(score.debt).toBe(52)
  })

  it('savingsTotal 제공 시 저축성 지출 기반으로 savings 점수를 계산한다', () => {
    // savingsTotal=1000000 / incomeTotal=5000000 = 20% 저축률
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      savingsTotal: 1000000,
    })
    // savingsRate=20% → savings = 30 + (20/50)*70 = 58
    expect(score.savings).toBe(58)
  })

  it('savingsTotal=0이면 savings 점수가 30이다 (0% 저축률)', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      savingsTotal: 0,
    })
    // savingsRate=0% → savings = 30 + (0/50)*70 = 30
    expect(score.savings).toBe(30)
  })

  it('savingsTotal 미제공 시 기존 방식으로 계산한다', () => {
    const withSavings = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      savingsTotal: 900000, // 18% 저축률
    })
    const withoutSavings = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      // savingsTotal 미제공 → (5000000-3200000)/5000000 = 36% 저축률
    })
    // 서로 다른 계산 방식이므로 점수가 다를 수 있음
    expect(withSavings.savings).not.toBe(withoutSavings.savings)
  })

  it('점수 범위는 항상 0-100 사이다', () => {
    // 극단적 케이스: 수입 없이 지출만 있음
    const worst = calculateHealthScore({
      incomeTotal: 100,
      expenseTotal: 10000000,
      budgetTotal: 1000,
      budgetSpent: 10000000,
      totalLiabilities: 100000000,
      totalAssets: 1,
      avgLoanRate: 20,
    })
    expect(worst.savings).toBeGreaterThanOrEqual(0)
    expect(worst.savings).toBeLessThanOrEqual(100)
    expect(worst.spending).toBeGreaterThanOrEqual(0)
    expect(worst.spending).toBeLessThanOrEqual(100)
    expect(worst.debt).toBeGreaterThanOrEqual(0)
    expect(worst.debt).toBeLessThanOrEqual(100)
    expect(worst.overall).toBeGreaterThanOrEqual(0)
    expect(worst.overall).toBeLessThanOrEqual(100)

    // 극단적 케이스: 모든 조건 완벽
    const best = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 0,
      budgetTotal: 5000000,
      budgetSpent: 0,
      totalLiabilities: 0,
      totalAssets: 100000000,
      avgLoanRate: 0,
    })
    expect(best.savings).toBeGreaterThanOrEqual(0)
    expect(best.savings).toBeLessThanOrEqual(100)
    expect(best.spending).toBe(100)
    expect(best.debt).toBe(100)
    expect(best.overall).toBeLessThanOrEqual(100)
  })
})
