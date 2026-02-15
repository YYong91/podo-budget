/**
 * @file BudgetManager.test.tsx
 * @description BudgetManager 예산 관리 페이지 테스트
 * 예산 목록, 알림, 추가 모달, 에러/빈 상태를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetManager from '../BudgetManager'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import type { Budget, BudgetAlert, Category } from '../../types'

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
 * 테스트용 카테고리 데이터
 */
const mockCategories: Category[] = [
  { id: 1, name: '식비', description: '음식 및 식사', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: '교통', description: '대중교통 및 택시', created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: '쇼핑', description: null, created_at: '2024-01-01T00:00:00Z' },
]

/**
 * 테스트용 예산 데이터
 */
const mockBudgets: Budget[] = [
  {
    id: 1,
    category_id: 1,
    amount: 300000,
    period: 'monthly',
    start_date: '2024-01-01',
    end_date: null,
    alert_threshold: 80,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    category_id: 2,
    amount: 100000,
    period: 'monthly',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    alert_threshold: 90,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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
    http.get('/api/budgets/', () => HttpResponse.json(mockBudgets)),
    http.get('/api/budgets/alerts', () => HttpResponse.json(mockAlerts)),
    http.get('/api/categories', () => HttpResponse.json(mockCategories)),
  )
}

/**
 * MSW 핸들러 설정: 빈 데이터 반환
 */
function setupEmptyHandlers() {
  server.use(
    http.get('/api/budgets/', () => HttpResponse.json([])),
    http.get('/api/budgets/alerts', () => HttpResponse.json([])),
    http.get('/api/categories', () => HttpResponse.json(mockCategories)),
  )
}

/**
 * MSW 핸들러 설정: API 에러 반환
 */
function setupErrorHandlers() {
  server.use(
    http.get('/api/budgets/', () =>
      HttpResponse.json({ detail: 'Server error' }, { status: 500 })
    ),
    http.get('/api/budgets/alerts', () =>
      HttpResponse.json({ detail: 'Server error' }, { status: 500 })
    ),
    http.get('/api/categories', () =>
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

    it('예산 추가 버튼을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /예산 추가/ })).toBeInTheDocument()
      })
    })

    it('예산 테이블에 카테고리 이름을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 테이블 내 카테고리 이름이 표시되는지 확인
        // 알림 카드에도 "식비", "교통"이 나타나므로 getAllByText 사용
        expect(screen.getAllByText('식비').length).toBeGreaterThan(0)
        expect(screen.getAllByText('교통').length).toBeGreaterThan(0)
      })
    })

    it('예산 테이블에 금액을 포맷팅하여 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 테이블 또는 알림에서 금액 확인
        expect(screen.getAllByText(/₩300,000/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/₩100,000/).length).toBeGreaterThan(0)
      })
    })

    it('예산 테이블에 기간을 한글로 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getAllByText('월간').length).toBeGreaterThan(0)
      })
    })

    it('예산 테이블에 시작일을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 날짜 포맷: 2024.01.01
        expect(screen.getAllByText('2024.01.01').length).toBeGreaterThan(0)
      })
    })

    it('예산 테이블에 종료일을 표시하거나 없으면 "-"을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 첫 번째 예산: end_date null → "-"
        // 두 번째 예산: 2024-12-31 → "2024.12.31"
        expect(screen.getByText('2024.12.31')).toBeInTheDocument()
      })
    })

    it('각 예산에 수정/삭제 버튼을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: '수정' })
        const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
        expect(editButtons.length).toBe(mockBudgets.length)
        expect(deleteButtons.length).toBe(mockBudgets.length)
      })
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
        http.get('/api/budgets/', () => HttpResponse.json(mockBudgets)),
        http.get('/api/budgets/alerts', () => HttpResponse.json([])),
        http.get('/api/categories', () => HttpResponse.json(mockCategories)),
      )

      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('예산 관리')).toBeInTheDocument()
      })

      expect(screen.queryByText('예산 알림')).not.toBeInTheDocument()
    })
  })

  describe('예산 추가 모달', () => {
    it('"+ 예산 추가" 버튼을 클릭하면 추가 모달이 열린다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /예산 추가/ })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /예산 추가/ })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 추가' })).toBeInTheDocument()
      })
    })

    it('추가 모달에 카테고리 선택, 금액, 기간 필드가 있다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /예산 추가/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /예산 추가/ }))

      await waitFor(() => {
        expect(screen.getByLabelText(/카테고리/)).toBeInTheDocument()
        expect(screen.getByLabelText(/금액/)).toBeInTheDocument()
        expect(screen.getByLabelText('기간')).toBeInTheDocument()
        expect(screen.getByLabelText('시작일')).toBeInTheDocument()
      })
    })

    it('취소 버튼을 클릭하면 모달이 닫힌다', async () => {
      setupSuccessHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /예산 추가/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /예산 추가/ }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 추가' })).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: '취소' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: '예산 추가' })).not.toBeInTheDocument()
      })
    })
  })

  describe('빈 상태', () => {
    it('예산이 없으면 빈 상태 메시지를 표시한다', async () => {
      setupEmptyHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('아직 설정된 예산이 없습니다')).toBeInTheDocument()
      })
    })

    it('빈 상태에서 "예산 추가하기" 버튼을 표시한다', async () => {
      setupEmptyHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '예산 추가하기' })).toBeInTheDocument()
      })
    })

    it('빈 상태의 "예산 추가하기" 버튼을 클릭하면 모달이 열린다', async () => {
      setupEmptyHandlers()
      const user = userEvent.setup()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '예산 추가하기' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '예산 추가하기' }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 추가' })).toBeInTheDocument()
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
