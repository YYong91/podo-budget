import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const mockWithExceeded: BudgetMonthlyStatsResponse = {
  month: '2026-04',
  total_budget: 500000,
  total_spent: 540000,
  categories: [
    { category_name: '식비', budget_amount: 200000, spent_amount: 220000, remaining_amount: -20000, usage_percentage: 110, is_exceeded: true },
    { category_name: '교통', budget_amount: 100000, spent_amount: 80000, remaining_amount: 20000, usage_percentage: 80, is_exceeded: false },
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

  it('기본 접힌 상태에서는 카테고리 목록을 표시하지 않는다', () => {
    renderComponent()
    expect(screen.queryByText('식비')).not.toBeInTheDocument()
  })

  it('펼치기 클릭 시 전체 카테고리 목록을 표시한다', async () => {
    renderComponent()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
  })

  it('접힌 상태에서 총예산과 총지출 오버뷰를 표시한다', () => {
    renderComponent()
    // mockBudgetStats: total_budget: 500000, total_spent: 320000
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    expect(screen.getByText(/320,000/)).toBeInTheDocument()
  })

  it('초과 카테고리가 있으면 초과 배지를 표시한다', () => {
    renderComponent({ budgetStats: mockWithExceeded })
    expect(screen.getByText(/초과/)).toBeInTheDocument()
  })

  it('total_budget이 null이면 예산 미설정 안내를 표시한다', () => {
    const statsNoTotal = { ...mockBudgetStats, total_budget: null as unknown as number }
    renderComponent({ budgetStats: statsNoTotal })
    expect(screen.getByText(/예산이 설정되지 않았습니다/)).toBeInTheDocument()
  })
})
