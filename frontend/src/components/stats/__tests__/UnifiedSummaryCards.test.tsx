import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UnifiedSummaryCards from '../UnifiedSummaryCards'

const renderCards = (props = {}) => render(
  <MemoryRouter>
    <UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} {...props} />
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

  it('savingsTotal 미제공 시 저축률 카드에 "설정 필요"가 표시된다', () => {
    renderCards({ savingsTotal: undefined })
    expect(screen.getByText('설정 필요')).toBeInTheDocument()
  })

  it('savingsTotal 제공 시 is_savings 기반 저축률을 표시한다', () => {
    // 700_000 / 3_500_000 = 20.0%
    render(
      <MemoryRouter>
        <UnifiedSummaryCards incomeTotal={3_500_000} expenseTotal={1_200_000} savingsTotal={700_000} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('20.0%')
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

  it('ChangeIndicator(지난달 %)를 표시하지 않는다', () => {
    render(
      <MemoryRouter>
        <UnifiedSummaryCards
          incomeTotal={3_500_000}
          expenseTotal={1_200_000}
          savingsTotal={500_000}
        />
      </MemoryRouter>
    )
    expect(screen.queryByText(/지난달/)).not.toBeInTheDocument()
  })

  it('저축률 "설정 필요" 클릭 시 /categories로 이동한다', async () => {
    render(
      <MemoryRouter>
        <UnifiedSummaryCards incomeTotal={3_500_000} expenseTotal={1_200_000} savingsTotal={undefined} />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /설정 필요/ })
    expect(link).toHaveAttribute('href', '/categories')
  })

  it('적자일 때 남은 돈 카드에 음수 금액을 표시한다', () => {
    renderCards({ incomeTotal: 2000000, expenseTotal: 2400000 })
    expect(screen.getByTestId('net-income-value')).toHaveTextContent('-₩400,000')
  })

  it('수입이 0이고 savingsTotal 미제공 시 저축률 카드에 "설정 필요"를 표시한다', () => {
    render(<MemoryRouter><UnifiedSummaryCards incomeTotal={0} expenseTotal={100000} /></MemoryRouter>)
    expect(screen.getByText('설정 필요')).toBeInTheDocument()
  })

  describe('네비게이션', () => {
    it('FEATURES.assets가 false이면 순자산 카드를 숨긴다', () => {
      // VITE_FEATURE_ASSETS 미설정 시 false → 카드 숨김
      renderCards({ netWorth: 50000000 })
      expect(screen.queryByText('순자산')).not.toBeInTheDocument()
    })

    it('총 수입 카드는 링크가 아닌 div이다', () => {
      renderCards()
      const card = screen.getByText('총 수입').closest('div')
      expect(card?.tagName).toBe('DIV')
      expect(screen.getByText('총 수입').closest('a')).toBeNull()
    })

    it('총 지출 카드는 링크가 아닌 div이다', () => {
      renderCards()
      const card = screen.getByText('총 지출').closest('div')
      expect(card?.tagName).toBe('DIV')
      expect(screen.getByText('총 지출').closest('a')).toBeNull()
    })
  })
})
