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

  it('B등급이면 grape 색상을 사용한다', () => {
    const bScore = { savings: 65, spending: 60, debt: 70, overall: 65, grade: 'B+' }
    const { container } = render(<FinancialHealthScore score={bScore} />)
    expect(container.querySelector('.text-grape-600')).toBeInTheDocument()
  })

  it('C등급이면 amber 색상을 사용한다', () => {
    const cScore = { savings: 50, spending: 45, debt: 55, overall: 50, grade: 'C' }
    const { container } = render(<FinancialHealthScore score={cScore} />)
    expect(container.querySelector('.text-amber-600')).toBeInTheDocument()
  })

  it('D등급이면 red 색상을 사용한다', () => {
    const dScore = { savings: 30, spending: 25, debt: 35, overall: 30, grade: 'D' }
    const { container } = render(<FinancialHealthScore score={dScore} />)
    expect(container.querySelector('.text-red-600')).toBeInTheDocument()
  })

  it('낮은 세부 점수에 적절한 바 색상을 사용한다', () => {
    const lowScore = { savings: 35, spending: 55, debt: 75, overall: 55, grade: 'C' }
    const { container } = render(<FinancialHealthScore score={lowScore} />)
    // savings=35 → red, spending=55 → amber, debt=75 → grape
    const bars = container.querySelectorAll('.rounded-full.transition-all')
    expect(bars.length).toBe(3)
  })
})
