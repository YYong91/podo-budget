import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
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
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
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

  it('로딩 중 스켈레톤 UI를 표시한다', () => {
    render(<InsightsPage />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('API 에러 시 에러 상태를 표시한다', async () => {
    server.use(
      http.get('/api/expenses/stats', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/income/stats', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/expenses/stats/comparison', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/budgets/stats/monthly', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/assets/summary', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/assets/snapshots', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
    )

    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })
})
