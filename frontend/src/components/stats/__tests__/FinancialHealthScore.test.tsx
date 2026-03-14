import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FinancialHealthScore from '../FinancialHealthScore'

describe('FinancialHealthScore', () => {
  const mockScore = {
    savings: 85,
    spending: 72,
    debt: 90,
    overall: 82,
    grade: 'A',
  }

  it('종합 점수와 등급을 표시한다', () => {
    render(<FinancialHealthScore score={mockScore} />)
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('세부 항목(저축, 지출, 부채)을 표시한다', () => {
    render(<FinancialHealthScore score={mockScore} />)
    expect(screen.getByText('저축')).toBeInTheDocument()
    expect(screen.getByText('지출 관리')).toBeInTheDocument()
    expect(screen.getByText('부채')).toBeInTheDocument()
  })

  it('score가 null이면 null을 반환한다', () => {
    const { container } = render(<FinancialHealthScore score={null} />)
    expect(container.firstChild).toBeNull()
  })
})
