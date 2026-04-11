import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InsightsOnboarding from '../InsightsOnboarding'

const defaultProps = {
  hasTransactions: true,
  hasBudget: false,
  hasRecurring: false,
  hasSavingsCategory: false,
}

function renderOnboarding(props = defaultProps) {
  return render(<MemoryRouter><InsightsOnboarding {...props} /></MemoryRouter>)
}

describe('InsightsOnboarding', () => {
  it('안내 타이틀을 표시한다', () => {
    renderOnboarding()
    expect(screen.getByText('아직 데이터가 모이는 중이에요')).toBeInTheDocument()
  })

  it('거래 기록 완료 항목은 line-through 스타일을 적용한다', () => {
    renderOnboarding({ ...defaultProps, hasTransactions: true })
    const transactionItem = screen.getByText('거래 5건 이상 기록하기').closest('li')
    expect(transactionItem).toHaveClass('line-through')
  })

  it('미완료 항목은 line-through 스타일이 없다', () => {
    renderOnboarding({ ...defaultProps, hasBudget: false })
    const budgetItem = screen.getByText('예산 설정하기').closest('li')
    expect(budgetItem).not.toHaveClass('line-through')
  })

  it('가계부로 가기 버튼이 /home으로 이동한다', () => {
    renderOnboarding()
    const link = screen.getByRole('link', { name: /가계부로 가기/ })
    expect(link).toHaveAttribute('href', '/home')
  })
})
