import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CombinedTrendChart from '../CombinedTrendChart'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
}))

const mockTrend = [
  { label: '03/01', amount: 80000 },
  { label: '03/02', amount: 120000 },
]

describe('CombinedTrendChart', () => {
  it('수입과 지출 범례를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('데이터가 없을 때 빈 상태를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={[]} incomeTrend={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })

  it('차트 제목을 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('수입 / 지출 흐름')).toBeInTheDocument()
  })
})
