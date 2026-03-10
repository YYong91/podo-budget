import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chart as ChartJS } from 'chart.js'
import CombinedTrendChart from '../CombinedTrendChart'

vi.mock('react-chartjs-2', () => ({
  Chart: () => <div data-testid="mock-chart" />,
}))

const mockTrend = [
  { label: '03/01', amount: 80000 },
  { label: '03/02', amount: 120000 },
]

describe('CombinedTrendChart', () => {
  it('수입, 지출, 순수익 범례를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
    expect(screen.getByText('순수익')).toBeInTheDocument()
  })

  it('데이터가 없을 때 빈 상태를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={[]} incomeTrend={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })

  it('차트 제목을 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('수입 / 지출 흐름')).toBeInTheDocument()
  })

  // 회귀 방지: mixed chart(bar+line)에 필요한 컨트롤러가 등록되어 있지 않으면
  // 런타임에서 "bar is not a registered controller" 에러 발생
  it('BarController가 Chart.js 레지스트리에 등록되어 있다', () => {
    expect(ChartJS.registry.controllers.get('bar')).toBeDefined()
  })

  it('LineController가 Chart.js 레지스트리에 등록되어 있다', () => {
    expect(ChartJS.registry.controllers.get('line')).toBeDefined()
  })
})
