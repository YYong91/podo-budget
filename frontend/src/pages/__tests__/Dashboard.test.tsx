/**
 * @file Dashboard.test.tsx
 * @description Dashboard 페이지 테스트
 * 월별 통계, 차트, 최근 지출 목록, 로딩/에러 상태를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Dashboard from '../Dashboard'
import { mockMonthlyStats, mockExpenses } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

/**
 * Dashboard를 라우터로 감싸서 렌더링
 */
function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  describe('로딩 상태', () => {
    it('데이터 로드 중에는 로딩 스피너를 표시한다', () => {
      renderDashboard()
      // 로딩 스피너는 animate-spin 클래스를 가진 div로 렌더링됨
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('정상 데이터 표시', () => {
    it('페이지 제목을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument()
      })
    })

    it('이번 달 총 지출을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('이번 달 총 지출')).toBeInTheDocument()
        expect(screen.getByText(`₩${mockMonthlyStats.total.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('카테고리 수를 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('카테고리 수')).toBeInTheDocument()
        expect(screen.getByText(String(mockMonthlyStats.by_category.length))).toBeInTheDocument()
      })
    })

    it('기록된 일수를 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('기록된 일수')).toBeInTheDocument()
        expect(screen.getByText(String(mockMonthlyStats.daily_trend.length))).toBeInTheDocument()
      })
    })

    it('일 평균 지출을 표시한다', async () => {
      renderDashboard()
      const average = Math.round(mockMonthlyStats.total / mockMonthlyStats.daily_trend.length)
      await waitFor(() => {
        expect(screen.getByText('일 평균 지출')).toBeInTheDocument()
        expect(screen.getByText(`₩${average.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })
  })

  describe('차트 렌더링', () => {
    it('카테고리별 지출 차트 제목을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('카테고리별 지출')).toBeInTheDocument()
      })
    })

    it('일별 지출 추이 차트 제목을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('일별 지출 추이')).toBeInTheDocument()
      })
    })

    it('차트 데이터가 없으면 빈 메시지를 표시한다', async () => {
      // 빈 데이터 응답 설정
      server.use(
        http.get('/api/expenses/stats/monthly', () => {
          return HttpResponse.json({
            month: '2024-01',
            total: 0,
            by_category: [],
            daily_trend: [],
          })
        }),
        http.get('/api/expenses', () => {
          return HttpResponse.json([])
        })
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/아직 이번 달 지출 기록이 없어요/i)).toBeInTheDocument()
      })
    })
  })

  describe('최근 지출 목록', () => {
    it('최근 지출 섹션 제목을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('최근 지출')).toBeInTheDocument()
      })
    })

    it('전체 보기 링크를 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /전체 보기/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/expenses')
      })
    })

    it('최근 지출 목록을 표시한다', async () => {
      renderDashboard()
      await waitFor(() => {
        // 첫 번째 지출 항목
        expect(screen.getByText(mockExpenses[0].description)).toBeInTheDocument()
        expect(screen.getByText(`₩${mockExpenses[0].amount.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('지출 항목을 클릭하면 상세 페이지로 이동한다', async () => {
      renderDashboard()
      await waitFor(() => {
        // Link 컴포넌트로 감싸진 description 텍스트를 찾음
        const links = screen.getAllByRole('link')
        const expenseLink = links.find(link => link.textContent?.includes(mockExpenses[0].description))
        expect(expenseLink).toHaveAttribute('href', `/expenses/${mockExpenses[0].id}`)
      })
    })
  })

  describe('빈 상태', () => {
    it('데이터가 없으면 빈 상태 UI를 표시한다', async () => {
      server.use(
        http.get('/api/expenses/stats/monthly', () => {
          return HttpResponse.json({
            month: '2024-01',
            total: 0,
            by_category: [],
            daily_trend: [],
          })
        }),
        http.get('/api/expenses', () => {
          return HttpResponse.json([])
        })
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/아직 이번 달 지출 기록이 없어요/i)).toBeInTheDocument()
      })
    })

    it('빈 상태에서 Telegram 봇 연결하기 버튼을 표시한다', async () => {
      server.use(
        http.get('/api/expenses/stats/monthly', () => {
          return HttpResponse.json({
            month: '2024-01',
            total: 0,
            by_category: [],
            daily_trend: [],
          })
        }),
        http.get('/api/expenses', () => {
          return HttpResponse.json([])
        })
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Telegram 봇 연결하기/i })).toBeInTheDocument()
      })
    })
  })

  describe('에러 상태', () => {
    it('API 에러 발생 시 에러 상태를 표시한다', async () => {
      server.use(
        http.get('/api/expenses/stats/monthly', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })
    })

    it('에러 상태에서 다시 시도 버튼을 클릭하면 데이터를 재로드한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.get('/api/expenses/stats/monthly', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })

      // 핸들러를 정상으로 복구
      server.resetHandlers()

      const retryButton = screen.getByRole('button', { name: '다시 시도' })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('이번 달 총 지출')).toBeInTheDocument()
      })
    })
  })
})
