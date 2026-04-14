import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(screen.getByText('+20만원')).toBeInTheDocument()
  })

  it('지출 감소는 text-leaf-600으로 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    const changeEl = screen.getByText('-10만원')
    expect(changeEl).toHaveClass('text-leaf-600')
  })

  it('펼쳤을 때 카테고리 변화 TOP3를 표시한다', async () => {
    const user = userEvent.setup()
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    await user.click(screen.getByRole('button', { name: /펼치기/ }))
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it('trend 데이터가 2개 이상이면 TrendBarChart를 렌더한다', async () => {
    const user = userEvent.setup()
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    await user.click(screen.getByRole('button', { name: /펼치기/ }))
    expect(screen.getByTestId('trend-bar-chart')).toBeInTheDocument()
  })

  it('trend 데이터가 2개 미만이면 TrendBarChart를 렌더하지 않는다', async () => {
    const user = userEvent.setup()
    render(
      <MonthlyComparison
        expenseComparison={{ ...mockComparison, trend: [{ label: '4월', total: 1_200_000 }] }}
        incomeComparison={{ ...mockIncomeComparison, trend: [{ label: '4월', total: 3_500_000 }] }}
      />
    )
    await user.click(screen.getByRole('button', { name: /펼치기/ }))
    expect(screen.queryByTestId('trend-bar-chart')).not.toBeInTheDocument()
    expect(screen.getByText(/비교할 이전 데이터가 없습니다/)).toBeInTheDocument()
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

  describe('접기/펼치기', () => {
    it('기본 상태(접힌)에서 지난달 수치를 표시한다', () => {
      render(
        <MonthlyComparison
          expenseComparison={mockComparison}
          incomeComparison={mockIncomeComparison}
        />
      )
      // 이전달 지출 130만원
      expect(screen.getByText('130만원')).toBeInTheDocument()
      // 이번달 지출 120만원
      expect(screen.getByText('120만원')).toBeInTheDocument()
    })

    it('기본 상태(접힌)에서 카테고리 변화 TOP3를 표시하지 않는다', () => {
      render(
        <MonthlyComparison
          expenseComparison={mockComparison}
          incomeComparison={mockIncomeComparison}
        />
      )
      expect(screen.queryByText('카테고리 변화')).not.toBeInTheDocument()
    })

    it('펼치기 버튼 클릭 시 카테고리 변화 TOP3를 표시한다', async () => {
      const user = userEvent.setup()
      render(
        <MonthlyComparison
          expenseComparison={mockComparison}
          incomeComparison={mockIncomeComparison}
        />
      )
      await user.click(screen.getByRole('button', { name: /펼치기/ }))
      expect(screen.getByText(/카테고리 변화/)).toBeInTheDocument()
    })
  })
})
