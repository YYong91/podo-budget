import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BudgetVsActual from '../BudgetVsActual'
import type { BudgetMonthlyStatsResponse } from '../../../types'

const mockBudgetStats: BudgetMonthlyStatsResponse = {
  month: '2026-04',
  total_budget: 500000,
  total_spent: 320000,
  categories: [
    { category_name: '식비', budget_amount: 200000, spent_amount: 150000, remaining_amount: 50000, usage_percentage: 75, is_exceeded: false },
    { category_name: '교통', budget_amount: 100000, spent_amount: 80000, remaining_amount: 20000, usage_percentage: 80, is_exceeded: false },
    { category_name: '쇼핑', budget_amount: 100000, spent_amount: 70000, remaining_amount: 30000, usage_percentage: 70, is_exceeded: false },
    { category_name: '통신', budget_amount: 50000, spent_amount: 15000, remaining_amount: 35000, usage_percentage: 30, is_exceeded: false },
    { category_name: '의료', budget_amount: 50000, spent_amount: 5000, remaining_amount: 45000, usage_percentage: 10, is_exceeded: false },
  ],
}

function renderComponent(props: Partial<{ budgetStats: BudgetMonthlyStatsResponse | null; monthStr: string }> = {}) {
  return render(
    <MemoryRouter>
      <BudgetVsActual budgetStats={mockBudgetStats} {...props} />
    </MemoryRouter>
  )
}

describe('BudgetVsActual', () => {
  it('예산 상황 섹션을 표시한다', () => {
    renderComponent()
    expect(screen.getByRole('heading', { name: /예산 상황/ })).toBeInTheDocument()
  })

  it('헤더에 이모지가 포함된다', () => {
    renderComponent()
    const heading = screen.getByRole('heading', { name: /예산 상황/ })
    expect(heading.textContent).toMatch(/💰/)
  })

  it('관리 링크를 표시한다', () => {
    renderComponent()
    expect(screen.getByRole('link', { name: '관리' })).toBeInTheDocument()
  })

  it('budgetStats가 null이면 아무것도 렌더하지 않는다', () => {
    const { container } = renderComponent({ budgetStats: null })
    expect(container.firstChild).toBeNull()
  })

  it('카테고리 목록을 표시한다', () => {
    renderComponent()
    expect(screen.getByText('식비')).toBeInTheDocument()
  })
})
