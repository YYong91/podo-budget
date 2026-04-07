import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UnifiedSummaryCards from '../UnifiedSummaryCards'

const renderCards = (props = {}) => render(
  <MemoryRouter>
    <UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} monthStr="2026-03" {...props} />
  </MemoryRouter>
)

describe('UnifiedSummaryCards', () => {
  it('총 수입을 표시한다', () => {
    renderCards()
    expect(screen.getByText('총 수입')).toBeInTheDocument()
    expect(screen.getByText('₩3,200,000')).toBeInTheDocument()
  })

  it('총 지출을 표시한다', () => {
    renderCards()
    expect(screen.getByText('총 지출')).toBeInTheDocument()
    expect(screen.getByText('₩2,400,000')).toBeInTheDocument()
  })

  it('남은 돈을 올바르게 계산한다', () => {
    renderCards()
    expect(screen.getByText('남은 돈')).toBeInTheDocument()
    expect(screen.getByText('₩800,000')).toBeInTheDocument()
  })

  it('저축률을 올바르게 계산한다 (기존 방식: savingsTotal 미제공)', () => {
    renderCards()
    expect(screen.getByText('저축률')).toBeInTheDocument()
    // (3200000 - 2400000) / 3200000 * 100 = 25.0%
    expect(screen.getByText('25.0%')).toBeInTheDocument()
  })

  it('savingsTotal 제공 시 저축성 지출 기반으로 저축률을 계산한다', () => {
    // savingsTotal=640000 / incomeTotal=3200000 * 100 = 20.0%
    renderCards({ savingsTotal: 640000 })
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('20.0%')
  })

  it('savingsTotal=0이면 저축률 0.0%를 표시한다', () => {
    renderCards({ savingsTotal: 0 })
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('0.0%')
  })

  it('적자일 때 남은 돈 카드에 음수 금액을 표시한다', () => {
    renderCards({ incomeTotal: 2000000, expenseTotal: 2400000 })
    expect(screen.getByTestId('net-income-value')).toHaveTextContent('-₩400,000')
  })

  it('수입이 0일 때 저축률은 "-"를 표시한다', () => {
    render(<MemoryRouter><UnifiedSummaryCards incomeTotal={0} expenseTotal={100000} monthStr="2026-03" /></MemoryRouter>)
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('-')
  })

  describe('네비게이션', () => {
    it('FEATURES.assets가 false이면 순자산 카드를 숨긴다', () => {
      // VITE_FEATURE_ASSETS 미설정 시 false → 카드 숨김
      renderCards({ netWorth: 50000000 })
      expect(screen.queryByText('순자산')).not.toBeInTheDocument()
    })

    it('총 수입 카드 클릭 시 수입 필터 목록으로 이동한다', () => {
      renderCards()
      const link = screen.getByText('총 수입').closest('a')
      expect(link).toHaveAttribute('href', '/?month=2026-03&filter=income')
    })

    it('총 지출 카드 클릭 시 지출 필터 목록으로 이동한다', () => {
      renderCards()
      const link = screen.getByText('총 지출').closest('a')
      expect(link).toHaveAttribute('href', '/?month=2026-03&filter=expense')
    })
  })
})
