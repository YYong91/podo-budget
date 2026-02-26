/**
 * @file BudgetManager.test.tsx
 * @description BudgetManager 예산 관리 페이지 테스트
 * 카테고리 개요 로드, 인라인 예산 편집, 알림, 에러/빈 상태를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetManager from '../BudgetManager'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import type { BudgetAlert, CategoryBudgetOverview } from '../../types'

/**
 * addToast 모킹 함수
 */
let mockAddToast: ReturnType<typeof vi.fn>

/**
 * useToast 훅 모킹
 */
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

/**
 * 테스트용 카테고리 개요 데이터
 */
const mockOverview: CategoryBudgetOverview[] = [
  {
    category_id: 1,
    category_name: '식비',
    monthly_spending: [
      { year: 2024, month: 1, amount: 195000 },
      { year: 2023, month: 12, amount: 210000 },
      { year: 2023, month: 11, amount: 180000 },
    ],
    current_budget_id: 1,
    current_budget_amount: 300000,
    alert_threshold: 0.8,
  },
  {
    category_id: 2,
    category_name: '교통',
    monthly_spending: [{ year: 2024, month: 1, amount: 50000 }],
    current_budget_id: null,
    current_budget_amount: null,
    alert_threshold: null,
  },
]

/**
 * 테스트용 예산 알림 데이터
 */
const mockAlerts: BudgetAlert[] = [
  {
    budget_id: 1,
    category_id: 1,
    category_name: '식비',
    budget_amount: 300000,
    spent_amount: 250000,
    remaining_amount: 50000,
    usage_percentage: 83.3,
    is_exceeded: false,
    is_warning: true,
  },
  {
    budget_id: 2,
    category_id: 2,
    category_name: '교통',
    budget_amount: 100000,
    spent_amount: 120000,
    remaining_amount: -20000,
    usage_percentage: 120.0,
    is_exceeded: true,
    is_warning: true,
  },
]

/**
 * MSW 핸들러 설정: 정상 데이터 반환
 */
function setupSuccessHandlers() {
  server.use(
    http.get('/api/budgets/category-overview', () => HttpResponse.json(mockOverview)),
    http.get('/api/budgets/alerts', () => HttpResponse.json(mockAlerts)),
  )
}

/**
 * MSW 핸들러 설정: 빈 데이터 반환
 */
function setupEmptyHandlers() {
  server.use(
    http.get('/api/budgets/category-overview', () => HttpResponse.json([])),
    http.get('/api/budgets/alerts', () => HttpResponse.json([])),
  )
}

/**
 * MSW 핸들러 설정: API 에러 반환
 */
function setupErrorHandlers() {
  server.use(
    http.get('/api/budgets/category-overview', () =>
      HttpResponse.json({ detail: 'Server error' }, { status: 500 })
    ),
    http.get('/api/budgets/alerts', () =>
      HttpResponse.json({ detail: 'Server error' }, { status: 500 })
    ),
  )
}

/**
 * BudgetManager 렌더링 헬퍼
 */
function renderBudgetManager() {
  return render(<BudgetManager />)
}

beforeEach(() => {
  mockAddToast = vi.fn()
})

describe('BudgetManager', () => {
  describe('로딩 상태', () => {
    it('데이터 로드 중에는 로딩 스피너를 표시한다', () => {
      setupSuccessHandlers()
      renderBudgetManager()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('정상 데이터 표시', () => {
    it('데이터 로드 후 "예산 관리" 페이지 제목을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 관리' })).toBeInTheDocument()
      })
    })

    it('카테고리 목록을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getAllByText('식비').length).toBeGreaterThan(0)
        expect(screen.getAllByText('교통').length).toBeGreaterThan(0)
      })
    })

    it('카테고리별 최근 지출 내역을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 식비 최근 1월 195,000원
        expect(screen.getByText(/1월.*195,000원/)).toBeInTheDocument()
      })
    })

    it('예산이 있는 카테고리의 입력 필드에 금액이 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        const input = screen.getByLabelText('식비 예산')
        expect(input).toHaveValue(300000)
      })
    })

    it('예산이 없는 카테고리의 입력 필드는 비어있다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        const input = screen.getByLabelText('교통 예산')
        expect(input).toHaveValue(null)
      })
    })

    it('초기 로드 시 저장 버튼이 표시되지 않는다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 관리' })).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    })
  })

  describe('인라인 예산 편집', () => {
    it('금액 변경 시 저장 버튼이 나타난다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('교통 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('교통 예산')
      await user.type(input, '50000')

      expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    })

    it('기존 금액과 같은 값으로 되돌리면 저장 버튼이 사라진다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('식비 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('식비 예산')
      // 값 변경 후 원래 값으로 복원
      await user.clear(input)
      await user.type(input, '999000')
      expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()

      await user.clear(input)
      await user.type(input, '300000')
      expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    })

    it('새 예산 저장 시 POST API를 호출한다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()

      let postCalled = false
      server.use(
        http.post('/api/budgets/', () => {
          postCalled = true
          return HttpResponse.json(
            {
              id: 10,
              category_id: 2,
              amount: 50000,
              period: 'monthly',
              start_date: '2024-01-01T00:00:00Z',
              end_date: null,
              alert_threshold: 0.8,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            { status: 201 }
          )
        }),
      )

      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('교통 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('교통 예산')
      await user.type(input, '50000')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(postCalled).toBe(true)
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산이 저장되었습니다')
    })

    it('기존 예산 수정 시 PUT API를 호출한다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()

      let putCalled = false
      server.use(
        http.put('/api/budgets/1', () => {
          putCalled = true
          return HttpResponse.json({
            id: 1,
            category_id: 1,
            amount: 400000,
            period: 'monthly',
            start_date: '2024-01-01T00:00:00Z',
            end_date: null,
            alert_threshold: 0.8,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          })
        }),
      )

      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('식비 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('식비 예산')
      await user.clear(input)
      await user.type(input, '400000')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(putCalled).toBe(true)
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산이 저장되었습니다')
    })

    it('입력을 비우고 저장하면 기존 예산을 삭제한다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()

      let deleteCalled = false
      server.use(
        http.delete('/api/budgets/1', () => {
          deleteCalled = true
          return new HttpResponse(null, { status: 204 })
        }),
      )

      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('식비 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('식비 예산')
      await user.clear(input)

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(deleteCalled).toBe(true)
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산이 삭제되었습니다')
    })
  })

  describe('예산 알림', () => {
    it('경고 알림의 사용률을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('83.3%')).toBeInTheDocument()
      })
    })

    it('초과 알림의 사용률을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('120.0%')).toBeInTheDocument()
      })
    })

    it('예산 초과 시 경고 메시지를 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('예산을 초과했습니다!')).toBeInTheDocument()
      })
    })

    it('경고 상태일 때 80% 경고 메시지를 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('예산의 80%를 사용했습니다')).toBeInTheDocument()
      })
    })

    it('예산 알림 섹션 제목을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('예산 알림')).toBeInTheDocument()
      })
    })

    it('알림이 없으면 알림 섹션을 표시하지 않는다', async () => {
      server.use(
        http.get('/api/budgets/category-overview', () => HttpResponse.json(mockOverview)),
        http.get('/api/budgets/alerts', () => HttpResponse.json([])),
      )

      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('예산 관리')).toBeInTheDocument()
      })

      expect(screen.queryByText('예산 알림')).not.toBeInTheDocument()
    })
  })

  describe('빈 상태', () => {
    it('카테고리가 없으면 빈 상태 메시지를 표시한다', async () => {
      setupEmptyHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('등록된 카테고리가 없습니다')).toBeInTheDocument()
      })
    })
  })

  describe('에러 상태', () => {
    it('API 에러 발생 시 에러 상태를 표시한다', async () => {
      setupErrorHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })
    })

    it('에러 상태에서 "다시 시도" 버튼을 표시한다', async () => {
      setupErrorHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
      })
    })

    it('"다시 시도" 버튼을 클릭하면 데이터를 재로드한다', async () => {
      setupErrorHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })

      // 정상 핸들러로 복구
      setupSuccessHandlers()

      const retryButton = screen.getByRole('button', { name: '다시 시도' })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 관리' })).toBeInTheDocument()
      })
    })
  })
})
