/**
 * @file InsightsPage.test.tsx
 * @description InsightsPage 페이지 테스트
 * 탭 전환, 통계 표시, AI 인사이트 생성 기능을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'
import { mockInsights } from '../../mocks/fixtures'
import toast from 'react-hot-toast'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

// useHouseholdStore 모킹
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

// Chart.js 모킹 (JSDOM에서 canvas 미지원)
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
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

    it('4개의 탭을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByText('주간')).toBeInTheDocument()
      expect(screen.getByText('월간')).toBeInTheDocument()
      expect(screen.getByText('연간')).toBeInTheDocument()
      expect(screen.getByText('AI 인사이트')).toBeInTheDocument()
    })

    it('기본 탭은 월간이다', () => {
      renderInsightsPage()
      // 기간 네비게이터가 표시됨
      expect(screen.getByLabelText('이전 기간')).toBeInTheDocument()
      expect(screen.getByLabelText('다음 기간')).toBeInTheDocument()
    })
  })

  describe('통계 탭', () => {
    it('월간 통계가 로딩되면 요약 카드를 표시한다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
      })
    })

    it('월간 통계의 카테고리 섹션을 표시한다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        // 통합 뷰: 지출과 수입 각각 카테고리 섹션이 렌더링됨
        expect(screen.getAllByText('카테고리별 지출').length).toBeGreaterThan(0)
      })
    })

    it('주간 탭으로 전환할 수 있다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByText('주간'))
      // 주간 레이블에 "주차"가 포함됨
      await waitFor(() => {
        expect(screen.getByText(/주차/)).toBeInTheDocument()
      })
    })

    it('연간 탭으로 전환할 수 있다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByText('연간'))
      await waitFor(() => {
        expect(screen.getByText(/^\d{4}년$/)).toBeInTheDocument()
      })
    })

    it('기간 네비게이션 이전 버튼이 동작한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      // 초기 로딩 대기
      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
      })
      const prevButton = screen.getByLabelText('이전 기간')
      await user.click(prevButton)
      // 이전 월로 이동했으므로 라벨이 변경됨
      await waitFor(() => {
        expect(screen.getByLabelText('이전 기간')).toBeInTheDocument()
      })
    })

    it('월간 이전 버튼 클릭 시 정확히 한 달 이전으로 이동한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
      })

      // 현재 표시된 연/월 파악
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-based

      expect(screen.getByText(`${currentYear}년 ${currentMonth}월`)).toBeInTheDocument()

      // 이전 버튼 클릭
      await user.click(screen.getByLabelText('이전 기간'))

      // 정확히 1달 이전으로 이동해야 함 (UTC 오프셋으로 2달 이전으로 건너뛰면 안 됨)
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      expect(screen.getByText(`${prevYear}년 ${prevMonth}월`)).toBeInTheDocument()
    })

    it('통계 API 실패 시 에러 토스트를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'error')
      server.use(
        http.get('/api/expenses/stats', () => {
          return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
        })
      )
      renderInsightsPage()
      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('통계를 불러오는데 실패했습니다')
      })
    })
  })

  describe('예산 대비 지출 섹션', () => {
    it('월간 지출 탭에서 예산 대비 지출 섹션이 표시된다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByTestId('budget-vs-actual')).toBeInTheDocument()
      })
    })

    it('예산 대비 지출 제목과 카테고리 정보가 표시된다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('예산 대비 지출')).toBeInTheDocument()
      })
    })

    it('통합 뷰에서 예산 대비 지출 섹션이 지출 통계와 함께 표시된다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByTestId('budget-vs-actual')).toBeInTheDocument()
      })
    })
  })

  describe('지출/수입 토글', () => {
    it('기본값은 지출이다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
      })
    })

    it('통합 뷰에서 지출과 수입 통계를 함께 표시한다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
        expect(screen.getByText('총 수입')).toBeInTheDocument()
      })
    })

    it('AI 탭에서는 통계 섹션이 표시되지 않는다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByText('AI 인사이트'))
      expect(screen.queryByText('총 지출')).not.toBeInTheDocument()
    })
  })

  describe('AI 인사이트 탭', () => {
    async function switchToAiTab() {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByText('AI 인사이트'))
      return user
    }

    it('AI 탭에서 기간 네비게이터가 숨겨진다', async () => {
      await switchToAiTab()
      expect(screen.queryByLabelText('이전 기간')).not.toBeInTheDocument()
    })

    it('월 선택 입력 필드를 표시한다', async () => {
      await switchToAiTab()
      expect(screen.getByLabelText('분석할 월 선택')).toBeInTheDocument()
    })

    it('인사이트 생성 버튼을 표시한다', async () => {
      await switchToAiTab()
      expect(screen.getByRole('button', { name: '인사이트 생성' })).toBeInTheDocument()
    })

    it('안내 문구를 표시한다', async () => {
      await switchToAiTab()
      expect(
        screen.getByText(/Claude API를 통해 해당 월의 지출 패턴을 분석/i)
      ).toBeInTheDocument()
    })

    it('인사이트가 없을 때 빈 상태를 표시한다', async () => {
      await switchToAiTab()
      expect(screen.getByText('월을 선택하고 인사이트를 생성하세요')).toBeInTheDocument()
    })

    it('현재 월이 기본값으로 선택되어 있다', async () => {
      await switchToAiTab()
      const monthInput = screen.getByLabelText('분석할 월 선택') as HTMLInputElement

      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      expect(monthInput.value).toBe(currentMonth)
    })

    it('생성 버튼 클릭 시 로딩 스피너를 표시한다', async () => {
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )

      const user = await switchToAiTab()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText(/AI가 당신의 지출을 분석하고 있습니다/i)).toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('생성 중에는 버튼이 비활성화된다', async () => {
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )

      const user = await switchToAiTab()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
      }, { timeout: 200 })
    })

    it('인사이트 생성 성공 시 토스트를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'success')

      const user = await switchToAiTab()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('인사이트가 생성되었습니다')
      })
    })

    it('인사이트 결과의 총 지출을 표시한다', async () => {
      const user = await switchToAiTab()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // AI 탭의 총 지출 (인사이트 결과)
        expect(screen.getByText(`₩${mockInsights.total.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('카테고리별 지출 섹션을 표시한다', async () => {
      const user = await switchToAiTab()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('카테고리별 지출')).toBeInTheDocument()
      })
    })

    it('월 선택을 변경할 수 있다', async () => {
      const user = await switchToAiTab()

      const monthInput = screen.getByLabelText('분석할 월 선택') as HTMLInputElement

      await user.clear(monthInput)
      await user.click(monthInput)

      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(monthInput, { target: { value: '2024-02' } })

      expect(monthInput).toHaveValue('2024-02')
    })

    it('빈 월 선택으로 생성 시도하면 에러 메시지를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'error')

      const user = await switchToAiTab()

      const monthInput = screen.getByLabelText('분석할 월 선택')
      await user.clear(monthInput)

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      expect(toastSpy).toHaveBeenCalledWith('월을 선택해주세요')
    })
  })
})
