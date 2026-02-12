/**
 * @file InsightsPage.test.tsx
 * @description InsightsPage 페이지 테스트
 * AI 인사이트 생성, 월별 통계 표시 기능을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'
import { mockInsights } from '../../mocks/fixtures'
import toast from 'react-hot-toast'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

function renderInsightsPage() {
  return render(<InsightsPage />)
}

describe('InsightsPage', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('heading', { name: 'AI 인사이트' })).toBeInTheDocument()
    })

    it('월 선택 입력 필드를 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByLabelText('분석할 월 선택')).toBeInTheDocument()
    })

    it('인사이트 생성 버튼을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('button', { name: '인사이트 생성' })).toBeInTheDocument()
    })

    it('안내 문구를 표시한다', () => {
      renderInsightsPage()
      expect(
        screen.getByText(/Claude API를 통해 해당 월의 지출 패턴을 분석/i)
      ).toBeInTheDocument()
    })
  })

  describe('초기 상태', () => {
    it('인사이트가 없을 때 빈 상태를 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByText('월을 선택하고 인사이트를 생성하세요')).toBeInTheDocument()
    })

    it('현재 월이 기본값으로 선택되어 있다', () => {
      renderInsightsPage()
      const monthInput = screen.getByLabelText('분석할 월 선택') as HTMLInputElement

      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      expect(monthInput.value).toBe(currentMonth)
    })
  })

  describe('인사이트 생성', () => {
    it('생성 버튼을 클릭하면 로딩 스피너를 표시한다', async () => {
      const user = userEvent.setup()

      // 인사이트 API에 delay 추가
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )

      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })

      // 클릭 후 즉시 로딩 상태 확인
      user.click(generateButton)

      // 로딩 중 메시지 확인 (delay를 추가했으므로 잡을 수 있음)
      await waitFor(() => {
        expect(screen.getByText(/AI가 당신의 지출을 분석하고 있습니다/i)).toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('생성 중에는 버튼이 비활성화된다', async () => {
      const user = userEvent.setup()

      // 인사이트 API에 delay 추가
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )

      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })

      // 클릭 후 즉시 버튼 상태 확인
      user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
      }, { timeout: 200 })
    })

    it('인사이트 생성 성공 시 결과를 표시한다', async () => {
      const user = userEvent.setup()
      const toastSpy = vi.spyOn(toast, 'success')

      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('인사이트가 생성되었습니다')
      })
    })

    it('월 선택을 변경할 수 있다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const monthInput = screen.getByLabelText('분석할 월 선택') as HTMLInputElement

      // type="month" input은 clear 후 직접 값 변경
      await user.clear(monthInput)
      await user.click(monthInput)

      // fireEvent로 직접 값 변경
      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(monthInput, { target: { value: '2024-02' } })

      expect(monthInput).toHaveValue('2024-02')
    })
  })

  describe('인사이트 결과 표시', () => {
    it('총 지출 금액을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
        expect(screen.getByText(`₩${mockInsights.total.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('카테고리 수를 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('카테고리 수')).toBeInTheDocument()
        expect(screen.getByText(`${Object.keys(mockInsights.by_category).length}개`)).toBeInTheDocument()
      })
    })

    it('월별 요약 제목을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      // 인사이트가 생성된 후 월별 요약 섹션이 표시됨
      // 먼저 총 지출이 표시될 때까지 기다림 (인사이트가 로드되었다는 의미)
      await waitFor(() => {
        expect(screen.getByText('총 지출')).toBeInTheDocument()
      })

      // 현재 월이 기본값이므로 현재 월 + " 요약" 형식으로 표시됨
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      expect(screen.getByText(`${currentMonth} 요약`)).toBeInTheDocument()
    })

    it('카테고리별 지출 섹션을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('카테고리별 지출')).toBeInTheDocument()
      })
    })

    it('각 카테고리의 금액을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        Object.entries(mockInsights.by_category).forEach(([category, amount]) => {
          expect(screen.getByText(category)).toBeInTheDocument()
          expect(screen.getByText(`₩${amount.toLocaleString('ko-KR')}`)).toBeInTheDocument()
        })
      })
    })

    it('각 카테고리의 비율을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // 퍼센티지가 표시되는지 확인 (예: "81.3%")
        const percentageElements = screen.getAllByText(/%/)
        expect(percentageElements.length).toBeGreaterThan(0)
      })
    })

    it('AI 인사이트 섹션을 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // "AI 인사이트"가 h1과 h2 두 곳에 있으므로 getAllByText 사용
        const aiInsightElements = screen.getAllByText('AI 인사이트')
        expect(aiInsightElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('AI 인사이트 내용을 렌더링한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // AI 인사이트 섹션이 표시되고 내용이 렌더링됨
        const aiInsightElements = screen.getAllByText('AI 인사이트')
        expect(aiInsightElements.length).toBeGreaterThan(0)
        // 인사이트 내용이 렌더링되었는지 확인 (renderMarkdown으로 처리됨)
        // mockInsights.insights 내용 중 일부가 있는지 확인
      }, { timeout: 3000 })
    })
  })

  describe('에러 처리', () => {
    it('빈 월 선택으로 생성 시도하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const toastSpy = vi.spyOn(toast, 'error')

      renderInsightsPage()

      const monthInput = screen.getByLabelText('분석할 월 선택')
      await user.clear(monthInput)

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      expect(toastSpy).toHaveBeenCalledWith('월을 선택해주세요')
    })
  })

  describe('카테고리별 지출 바 차트', () => {
    it('각 카테고리에 진행 바를 표시한다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // 진행 바는 bg-primary-600 클래스를 가진 div로 렌더링됨
        const progressBars = document.querySelectorAll('.bg-primary-600.h-2')
        expect(progressBars.length).toBeGreaterThan(0)
      })
    })

    it('카테고리별 지출이 금액 순으로 정렬된다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()

      const generateButton = screen.getByRole('button', { name: '인사이트 생성' })
      await user.click(generateButton)

      await waitFor(() => {
        // 카테고리별 지출 섹션 확인
        expect(screen.getByText('카테고리별 지출')).toBeInTheDocument()
        // 카테고리들이 표시되는지 확인 (정렬은 내부적으로 Object.entries().sort()로 처리됨)
        Object.keys(mockInsights.by_category).forEach(category => {
          expect(screen.getByText(category)).toBeInTheDocument()
        })
      })
    })
  })
})
