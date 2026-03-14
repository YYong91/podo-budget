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
})
