import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrendChart from '../TrendChart'
import ComparisonChart from '../ComparisonChart'
import CategoryBreakdown from '../CategoryBreakdown'

describe('TrendChart', () => {
  it('데이터가 없으면 빈 상태를 표시한다', () => {
    render(<TrendChart data={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })

  it('제목을 표시한다', () => {
    render(<TrendChart data={[{ label: '02/01', amount: 10000 }]} title="일별 추이" />)
    expect(screen.getByText('일별 추이')).toBeInTheDocument()
  })
})

describe('ComparisonChart', () => {
  it('데이터가 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<ComparisonChart data={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('제목을 표시한다', () => {
    render(<ComparisonChart data={[{ label: '1월', total: 50000 }]} />)
    expect(screen.getByText('기간 비교')).toBeInTheDocument()
  })
})

describe('CategoryBreakdown', () => {
  it('카테고리별 이름과 금액을 표시한다', () => {
    render(
      <CategoryBreakdown
        categories={[
          { category: '식비', amount: 50000, count: 10, percentage: 80 },
          { category: '교통', amount: 12500, count: 5, percentage: 20 },
        ]}
      />
    )
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('₩50,000')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
  })

  it('비교 데이터가 있으면 변화량을 표시한다', () => {
    render(
      <CategoryBreakdown
        categories={[{ category: '식비', amount: 50000, count: 10, percentage: 100 }]}
        comparisons={[{ category: '식비', current: 50000, previous: 40000, change_amount: 10000, change_percentage: 25.0 }]}
      />
    )
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
  })

  it('카테고리가 없으면 빈 상태를 표시한다', () => {
    render(<CategoryBreakdown categories={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })
})
