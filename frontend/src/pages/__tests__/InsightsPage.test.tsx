import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Bar: () => <div data-testid="mock-bar-chart" />,
  Chart: () => <div data-testid="mock-chart" />,
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  LineElement: class {},
  PointElement: class {},
  BarController: class {},
  LineController: class {},
  Legend: class {},
  Tooltip: class {},
  Filler: class {},
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

describe('InsightsPage', () => {
  it('로딩 완료 후 종합 요약 카드를 표시한다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })
    expect(screen.getAllByText('총 지출').length).toBeGreaterThan(0)
  })

  it('월 네비게이션이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      const now = new Date()
      expect(screen.getByText(`${now.getFullYear()}년 ${now.getMonth() + 1}월`)).toBeInTheDocument()
    })
  })

  it('지출 카테고리 TOP이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('지출 카테고리 TOP')).toBeInTheDocument()
    })
  })

  it('AI 심층 분석 버튼이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('AI 심층 분석')).toBeInTheDocument()
    })
    expect(screen.getByText('분석하기')).toBeInTheDocument()
  })

  it('AI 분석 버튼 클릭 시 로딩 후 결과가 표시된다', async () => {
    const user = userEvent.setup()
    render(<InsightsPage />)

    await waitFor(() => {
      expect(screen.getByText('분석하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('분석하기'))

    await waitFor(() => {
      // 구조화된 인사이트가 표시됨
      expect(screen.getByText('핵심 발견')).toBeInTheDocument()
    })
  })

  it('주간/연간 토글이 없다 (월간 전용)', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.queryByText('주간')).not.toBeInTheDocument()
      expect(screen.queryByText('연간')).not.toBeInTheDocument()
    })
  })
})
