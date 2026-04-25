/**
 * @file BudgetManager.test.tsx
 * @description BudgetManager 예산 관리 페이지 테스트
 * 카테고리 개요 로드, 인라인 예산 편집, 상황, 월 총 예산, 에러/빈 상태를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    current_budget_id: 2,
    current_budget_amount: 100000,
    alert_threshold: 0.8,
  },
  {
    category_id: 3,
    category_name: '여가',
    monthly_spending: [],
    current_budget_id: null,
    current_budget_amount: null,
    alert_threshold: null,
  },
]

/**
 * 테스트용 예산 상황 데이터
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
function setupSuccessHandlers(totalBudget: number | null = null) {
  server.use(
    http.get('/api/budgets/category-overview', () => HttpResponse.json(mockOverview)),
    http.get('/api/budgets/alerts', () => HttpResponse.json(mockAlerts)),
    http.get('/api/budgets/total-budget', () =>
      HttpResponse.json({ total_monthly_budget: totalBudget })
    ),
  )
}

/**
 * MSW 핸들러 설정: 빈 데이터 반환
 */
function setupEmptyHandlers() {
  server.use(
    http.get('/api/budgets/category-overview', () => HttpResponse.json([])),
    http.get('/api/budgets/alerts', () => HttpResponse.json([])),
    http.get('/api/budgets/total-budget', () =>
      HttpResponse.json({ total_monthly_budget: null })
    ),
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
    http.get('/api/budgets/total-budget', () =>
      HttpResponse.json({ detail: 'Server error' }, { status: 500 })
    ),
  )
}

/**
 * BudgetManager 렌더링 헬퍼
 */
function renderBudgetManager() {
  return render(
    <MemoryRouter>
      <BudgetManager />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockAddToast = vi.fn()
})

describe('BudgetManager', () => {
  describe('기본 렌더링', () => {
    it('데이터 로드 후 페이지 헤더에 예산 관리 타이틀을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: '예산 관리' })).toBeInTheDocument()
      })
    })
  })

  describe('로딩 상태', () => {
    it('데이터 로드 중에는 로딩 스피너를 표시한다', () => {
      setupSuccessHandlers()
      renderBudgetManager()

      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).toBeInTheDocument()
    })
  })

  describe('정상 데이터 표시', () => {
    it('데이터 로드 후 월 총 예산 섹션을 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('월 총 예산')).toBeInTheDocument()
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

    it('예산이 있는 카테고리의 진행바 사용 금액이 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        // 식비 지출 ₩250,000 사용 (알림 데이터 기반)
        expect(screen.getByText(/₩250,000 사용/)).toBeInTheDocument()
      })
    })

    it('최근 지출 참고 텍스트가 표시되지 않는다 (진행바로 대체됨)', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('식비')).toBeInTheDocument()
      })

      // monthly_spending 기반 "X월 ₩Y" 텍스트는 더 이상 표시되지 않음
      expect(screen.queryByText(/1월.*₩195,000/)).not.toBeInTheDocument()
    })

    it('예산이 있는 카테고리의 입력 필드에 금액이 포맷되어 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        const input = screen.getByLabelText('식비 예산') as HTMLInputElement
        // blur 상태에서 ₩ 포맷으로 표시
        expect(input.value).toBe('₩300,000')
      })
    })

    it('예산이 없는 카테고리의 입력 필드는 비어있다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        const input = screen.getByLabelText('여가 예산') as HTMLInputElement
        expect(input.value).toBe('')
      })
    })

    it('초기 로드 시 저장 버튼이 표시되지 않는다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText('월 총 예산')).toBeInTheDocument()
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
        expect(screen.getByLabelText('여가 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('여가 예산')
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
        http.post('/api/budgets', () => {
          postCalled = true
          return HttpResponse.json(
            {
              id: 10,
              category_id: 3,
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
        expect(screen.getByLabelText('여가 예산')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('여가 예산')
      await user.type(input, '50000')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(postCalled).toBe(true)
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산을 저장했어요')
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
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산을 저장했어요')
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
      expect(mockAddToast).toHaveBeenCalledWith('success', '예산을 삭제했어요')
    })
  })

  describe('카테고리 행 — 예산 상황 통합', () => {
    it('예산 설정 + 지출 있는 카테고리는 진행바가 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('식비'))
      const progressBar = document.querySelector('[data-testid="progress-식비"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('예산 초과 카테고리는 초과 금액 텍스트가 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('교통'))
      expect(screen.getByText(/₩20,000 초과/)).toBeInTheDocument()
    })

    it('예산 미설정 카테고리는 진행바가 없다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('여가'))
      const progressBar = document.querySelector('[data-testid="progress-여가"]')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('"예산 상황" 섹션 헤더가 더 이상 렌더링되지 않는다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('식비'))
      expect(screen.queryByText('예산 상황')).not.toBeInTheDocument()
    })

    it('경고 상태 카테고리의 사용률 뱃지가 카테고리 행에 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('식비'))
      // 83.3% → toFixed(0) → "83%"
      expect(screen.getByText('83%')).toBeInTheDocument()
    })

    it('초과 상태 카테고리의 사용률 뱃지가 카테고리 행에 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('교통'))
      // 120.0% → toFixed(0) → "120%"
      expect(screen.getByText('120%')).toBeInTheDocument()
    })

    it('예산 설정 카테고리는 사용 금액 텍스트가 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('식비'))
      expect(screen.getByText(/₩250,000 사용/)).toBeInTheDocument()
    })

    it('예산 미초과 카테고리는 남은 금액 텍스트가 표시된다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByText('식비'))
      expect(screen.getByText(/₩50,000 남음/)).toBeInTheDocument()
    })
  })

  describe('월 총 예산', () => {
    it('월 총 예산 입력 필드를 표시한다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByLabelText('월 총 예산')).toBeInTheDocument()
      })
    })

    it('저장된 월 총 예산 금액을 포맷되어 표시한다', async () => {
      setupSuccessHandlers(3000000)
      renderBudgetManager()

      await waitFor(() => {
        const input = screen.getByLabelText('월 총 예산') as HTMLInputElement
        // blur 상태에서 ₩ 포맷으로 표시
        expect(input.value).toBe('₩3,000,000')
      })
    })

    it('월 총 예산 설정 시 배분 현황을 표시한다', async () => {
      setupSuccessHandlers(3000000)
      renderBudgetManager()

      await waitFor(() => {
        // 식비 300,000 배분됨 → 배정: ₩300,000 / ₩3,000,000
        expect(screen.getByText(/배정:/)).toBeInTheDocument()
        expect(screen.getByText(/남은 예산:/)).toBeInTheDocument()
      })
    })

    it('예산 사용률 뱃지를 카테고리 행에 표시한다', async () => {
      setupSuccessHandlers(3000000)
      renderBudgetManager()

      await waitFor(() => {
        // 식비 83.3% → toFixed(0) → "83%"
        expect(screen.getByText('83%')).toBeInTheDocument()
      })
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

  describe('금액 표시 스타일', () => {
    it('배분 현황의 배정/총 예산 금액에 tabular-nums 스타일 span이 있다', async () => {
      setupSuccessHandlers(3000000)
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText(/배정:/)).toBeInTheDocument()
      })

      // 배정 현황 행: 금액 표시 span들에 tabular-nums 적용
      const allSpans = document.querySelectorAll('span.tabular-nums')
      const allocationSpans = Array.from(allSpans).filter(
        (el) => el.textContent && (el.textContent.includes('₩300,000') || el.textContent.includes('₩3,000,000'))
      )
      expect(allocationSpans.length).toBeGreaterThan(0)
    })

    it('배분 현황의 남은 예산 금액에 tabular-nums 스타일 span이 있다', async () => {
      setupSuccessHandlers(3000000)
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText(/남은 예산:/)).toBeInTheDocument()
      })

      // 남은 예산: ₩3,000,000 - ₩300,000(식비) - ₩100,000(교통) = ₩2,600,000
      const allSpans = document.querySelectorAll('span.tabular-nums')
      const remainingSpans = Array.from(allSpans).filter(
        (el) => el.textContent && el.textContent.includes('₩2,600,000')
      )
      expect(remainingSpans.length).toBeGreaterThan(0)
    })

    it('카테고리 행 지출 금액에 tabular-nums 스타일 span이 있다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText(/₩250,000 사용/)).toBeInTheDocument()
      })

      // 사용 금액 span에 tabular-nums 적용 (식비: ₩250,000 사용)
      const allSpans = document.querySelectorAll('span.tabular-nums')
      const usageSpans = Array.from(allSpans).filter(
        (el) => el.textContent && el.textContent.includes('₩250,000')
      )
      expect(usageSpans.length).toBeGreaterThan(0)
    })

    it('카테고리 행 남은 금액에 tabular-nums 스타일 span이 있다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()

      await waitFor(() => {
        expect(screen.getByText(/₩50,000 남음/)).toBeInTheDocument()
      })

      // 남은 금액 span에 tabular-nums 적용 (식비: ₩50,000 남음)
      const allSpans = document.querySelectorAll('span.tabular-nums')
      const remainingSpans = Array.from(allSpans).filter(
        (el) => el.textContent && el.textContent.includes('₩50,000')
      )
      expect(remainingSpans.length).toBeGreaterThan(0)
    })
  })

  describe('금액 입력 포맷', () => {
    it('월 총 예산 입력란 — blur 시 ₩ 포맷으로 표시된다', async () => {
      const user = userEvent.setup()
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByLabelText('월 총 예산'))

      const input = screen.getByLabelText('월 총 예산') as HTMLInputElement
      await user.clear(input)
      await user.type(input, '200000')
      await user.tab()
      expect(input.value).toBe('₩200,000')
    })

    it('월 총 예산 입력란 — focus 시 raw 숫자로 표시된다', async () => {
      const user = userEvent.setup()
      setupSuccessHandlers(500000)
      renderBudgetManager()
      await waitFor(() => screen.getByLabelText('월 총 예산'))

      const input = screen.getByLabelText('월 총 예산') as HTMLInputElement
      await user.click(input)
      // 포커스 상태에서는 raw 숫자만 표시
      expect(input.value).toMatch(/^\d+$/)
    })

    it('카테고리 예산 입력란 — blur 시 ₩ 포맷으로 표시된다', async () => {
      const user = userEvent.setup()
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByLabelText('식비 예산'))

      const input = screen.getByLabelText('식비 예산') as HTMLInputElement
      await user.clear(input)
      await user.type(input, '300000')
      await user.tab()
      expect(input.value).toBe('₩300,000')
    })

    it('월 총 예산 입력란 — 인풋 옆에 "원" 텍스트가 없다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByLabelText('월 총 예산'))
      // 페이지 어디에도 단독 "원" 텍스트 노드가 없어야 함 (₩ 접두사 방식 사용)
      expect(screen.queryByText('원')).not.toBeInTheDocument()
    })

    it('예산 미설정 카테고리 — 입력란 placeholder가 "예산 없음"이다', async () => {
      setupSuccessHandlers()
      renderBudgetManager()
      await waitFor(() => screen.getByLabelText('여가 예산'))
      // 카테고리 예산 입력 필드는 예산 유무와 관계없이 placeholder="예산 없음" 표시
      const input = screen.getByLabelText('여가 예산') as HTMLInputElement
      expect(input.placeholder).toBe('예산 없음')
    })
  })

  describe('에러 상태 헤더', () => {
    it('에러 상태에서도 PiggyBank 아이콘이 렌더링된다', async () => {
      setupErrorHandlers()
      renderBudgetManager()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '예산 관리' })).toBeInTheDocument()
      })
      expect(screen.getByTestId('piggybank-icon')).toBeInTheDocument()
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
        expect(screen.getByText('월 총 예산')).toBeInTheDocument()
      })
    })
  })
})
