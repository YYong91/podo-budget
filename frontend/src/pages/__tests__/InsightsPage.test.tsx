/**
 * @file InsightsPage.test.tsx
 * @description InsightsPage 종합 리포트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'
import { mockInsights } from '../../mocks/fixtures'
import toast from 'react-hot-toast'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
}))

function renderInsightsPage() {
  return render(<InsightsPage />)
}

describe('InsightsPage', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('heading', { name: '리포트' })).toBeInTheDocument()
    })

    it('기간 네비게이터를 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByLabelText('이전 기간')).toBeInTheDocument()
      expect(screen.getByLabelText('다음 기간')).toBeInTheDocument()
    })

    it('주간/월간/연간 기간 선택 버튼을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('button', { name: '주간' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '월간' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '연간' })).toBeInTheDocument()
    })
  })

  describe('핵심 지표', () => {
    it('로딩 완료 후 총 수입/지출 카드를 표시한다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('총 수입')).toBeInTheDocument()
        // 총 지출은 UnifiedSummaryCards와 BudgetVsActual에 모두 나타남
        expect(screen.getAllByText('총 지출').length).toBeGreaterThan(0)
        expect(screen.getByText('순수익')).toBeInTheDocument()
        expect(screen.getByText('저축률')).toBeInTheDocument()
      })
    })
  })

  describe('기간 전환', () => {
    it('주간 버튼 클릭 시 주차 라벨이 표시된다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '주간' }))
      await waitFor(() => {
        expect(screen.getByText(/주차/)).toBeInTheDocument()
      })
    })

    it('연간 버튼 클릭 시 연도 라벨이 표시된다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '연간' }))
      await waitFor(() => {
        expect(screen.getByText(/^\d{4}년$/)).toBeInTheDocument()
      })
    })

    it('월간 이전 버튼 클릭 시 정확히 한 달 이전으로 이동한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      await waitFor(() => {
        expect(screen.getByText('총 수입')).toBeInTheDocument()
      })

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      expect(screen.getByText(`${currentYear}년 ${currentMonth}월`)).toBeInTheDocument()

      await user.click(screen.getByLabelText('이전 기간'))

      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      expect(screen.getByText(`${prevYear}년 ${prevMonth}월`)).toBeInTheDocument()
    })
  })

  describe('월간 전용 섹션', () => {
    it('월간 탭에서 예산 현황 섹션이 표시된다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByTestId('budget-vs-actual')).toBeInTheDocument()
      })
    })

    it('주간 탭에서 예산 현황 섹션이 숨겨진다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '주간' }))
      await waitFor(() => {
        expect(screen.queryByTestId('budget-vs-actual')).not.toBeInTheDocument()
      })
    })
  })

  describe('AI 심층 분석', () => {
    it('AI 분석 생성 버튼을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('button', { name: 'AI 심층 분석 생성하기' })).toBeInTheDocument()
    })

    it('생성 버튼 클릭 시 로딩 상태가 된다', async () => {
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )
      const user = userEvent.setup()
      renderInsightsPage()
      user.click(screen.getByRole('button', { name: 'AI 심층 분석 생성하기' }))
      await waitFor(() => {
        expect(screen.getByText(/분석하고 있습니다/)).toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('통계 API 실패 시 에러 토스트를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'error')
      server.use(
        http.get('/api/expenses/stats', () =>
          HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
        )
      )
      renderInsightsPage()
      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('통계를 불러오는데 실패했습니다')
      })
    })

    it('현재 월이 기본값으로 선택되어 있다', () => {
      renderInsightsPage()
      const monthInput = screen.getByLabelText('분석할 월 선택') as HTMLInputElement
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      expect(monthInput.value).toBe(currentMonth)
    })

    it('인사이트 생성 성공 시 토스트를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'success')
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: 'AI 심층 분석 생성하기' }))
      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('인사이트가 생성되었습니다')
      })
    })
  })
})
