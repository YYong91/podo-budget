import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MonthlyComparison from '../MonthlyComparison'

// ComparisonResponse 구조에 맞는 목 데이터
// trend: PeriodTotal[] — { label: string, total: number }
const mockComparison = {
  current: { label: '4월', total: 1_200_000 },
  previous: { label: '3월', total: 1_300_000 },
  change: { amount: -100_000, percentage: -7.7 },
  trend: [
    { label: '2월', total: 1_100_000 },
    { label: '3월', total: 1_300_000 },
    { label: '4월', total: 1_200_000 },
  ],
  by_category_comparison: [
    { category: '교통', current: 135_000, previous: 100_000, change_amount: 35_000, change_percentage: 35.0 },
    { category: '식비', current: 422_000, previous: 480_000, change_amount: -58_000, change_percentage: -12.1 },
    { category: '쇼핑', current: 270_000, previous: 220_000, change_amount: 50_000, change_percentage: 22.7 },
  ],
}

const mockIncomeComparison = {
  current: { label: '4월', total: 3_500_000 },
  previous: { label: '3월', total: 3_300_000 },
  change: { amount: 200_000, percentage: 6.1 },
  trend: [
    { label: '2월', total: 3_200_000 },
    { label: '3월', total: 3_300_000 },
    { label: '4월', total: 3_500_000 },
  ],
  by_category_comparison: [],
}

describe('MonthlyComparison', () => {
  it('수입 현재값과 변화량을 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
        savingsRateCurrent={15.1}
        savingsRatePrevious={14.2}
      />
    )
    expect(screen.getByText('수입')).toBeInTheDocument()
    expect(screen.getByText('+200,000')).toBeInTheDocument()
  })

  it('지출 감소는 text-leaf-600으로 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    const changeEl = screen.getByText(/-100,000/)
    expect(changeEl).toHaveClass('text-leaf-600')
  })

  it('카테고리 변화 TOP3를 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it('trend 데이터가 2개 미만이면 스파크라인을 렌더하지 않는다', () => {
    render(
      <MonthlyComparison
        expenseComparison={{ ...mockComparison, trend: [{ label: '4월', total: 1_200_000 }] }}
        incomeComparison={{ ...mockIncomeComparison, trend: [{ label: '4월', total: 3_500_000 }] }}
      />
    )
    expect(screen.queryAllByTestId('sparkline')).toHaveLength(0)
  })

  it('savingsRateCurrent 미제공 시 저축률 행을 표시하지 않는다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    expect(screen.queryByText('저축률')).not.toBeInTheDocument()
  })
})
