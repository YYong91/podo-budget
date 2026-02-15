import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsSummaryCards from '../StatsSummaryCards'

const mockData = {
  total: 580000,
  count: 42,
  trend: [
    { label: '02/01', amount: 25000 },
    { label: '02/02', amount: 18000 },
  ],
  changePercentage: -6.5 as number | null,
}

describe('StatsSummaryCards', () => {
  it('총 지출을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('총 지출')).toBeInTheDocument()
    expect(screen.getByText('₩580,000')).toBeInTheDocument()
  })

  it('건수를 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('건 수')).toBeInTheDocument()
    expect(screen.getByText('42건')).toBeInTheDocument()
  })

  it('일 평균을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('일 평균')).toBeInTheDocument()
  })

  it('전기 대비 변화량을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('전기 대비')).toBeInTheDocument()
    expect(screen.getByText('줄음')).toBeInTheDocument()
  })

  it('변화량이 null이면 비교 불가 표시', () => {
    render(<StatsSummaryCards {...mockData} changePercentage={null} />)
    expect(screen.getByText('비교 불가')).toBeInTheDocument()
  })
})
