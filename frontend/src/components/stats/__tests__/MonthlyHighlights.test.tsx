import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MonthlyHighlights, { generateHighlights } from '../MonthlyHighlights'
import type { BudgetMonthlyStatsResponse, ComparisonResponse } from '../../../types'

const baseBudget: BudgetMonthlyStatsResponse = {
  total_budget: 500000,
  total_spent: 400000,
  categories: [
    { category_name: '식비', budget_amount: 300000, spent_amount: 240000, usage_percentage: 80, is_exceeded: false },
  ],
}

const exceededBudget: BudgetMonthlyStatsResponse = {
  ...baseBudget,
  categories: [
    { category_name: '구독', budget_amount: 50000, spent_amount: 55000, usage_percentage: 110, is_exceeded: true },
  ],
}

const comparison: ComparisonResponse = {
  current: { label: '3월', total: 400000 },
  previous: { label: '2월', total: 480000 },
  change: { amount: -80000, percentage: -16.7 },
  trend: [],
  by_category_comparison: [
    { category: '식비', current: 240000, previous: 180000, change_amount: 60000, change_percentage: 33.3 },
  ],
}

describe('generateHighlights', () => {
  it('적자일 때 경고를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 200000, expenseTotal: 250000, budgetStats: null, comparison: null })
    expect(result.some(h => h.type === 'warning' && h.message.includes('초과'))).toBe(true)
  })

  it('예산 초과 카테고리 경고를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: exceededBudget, comparison: null })
    expect(result.some(h => h.message.includes('구독'))).toBe(true)
  })

  it('저축률 20% 이상일 때 성취 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 3200000, expenseTotal: 2400000, budgetStats: null, comparison: null })
    expect(result.some(h => h.type === 'positive' && h.message.includes('저축률'))).toBe(true)
  })

  it('전월 대비 지출 감소 시 성취 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: null, comparison })
    expect(result.some(h => h.type === 'positive' && h.message.includes('줄였'))).toBe(true)
  })

  it('카테고리 급증 시 일반 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: null, comparison })
    expect(result.some(h => h.message.includes('식비') && h.message.includes('33'))).toBe(true)
  })

  it('최대 4개만 반환한다', () => {
    const result = generateHighlights({ incomeTotal: 200000, expenseTotal: 250000, budgetStats: exceededBudget, comparison })
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('해당 없으면 빈 배열을 반환한다', () => {
    const result = generateHighlights({ incomeTotal: 0, expenseTotal: 0, budgetStats: null, comparison: null })
    expect(result).toHaveLength(0)
  })
})

describe('MonthlyHighlights', () => {
  it('하이라이트가 없으면 섹션을 렌더링하지 않는다', () => {
    const { container } = render(
      <MonthlyHighlights incomeTotal={0} expenseTotal={0} budgetStats={null} comparison={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('하이라이트가 있으면 섹션 제목을 표시한다', () => {
    render(
      <MonthlyHighlights incomeTotal={3200000} expenseTotal={2400000} budgetStats={null} comparison={null} />
    )
    expect(screen.getByText('💡 이번 달 주목할 점')).toBeInTheDocument()
  })
})
