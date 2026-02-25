/**
 * @file ExpenseForm.test.tsx
 * @description ExpenseForm 지출 입력 페이지 테스트
 * 자연어 입력 모드(LLM 프리뷰 → 저장), 폼 입력 모드를 테스트한다.
 *
 * 버그 재현 이력:
 * - Session 4 버그: LLM이 date: "2026-02-11" (YYYY-MM-DD) 반환 시
 *   handleConfirmSave가 item.date를 그대로 POST /api/expenses/에 전송 → 422
 * - 기존에 이 파일이 없어서 버그가 테스트에서 걸러지지 않았음
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ExpenseForm from '../ExpenseForm'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

/** navigate 모킹 */
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

/** addToast 모킹 */
let mockAddToast: ReturnType<typeof vi.fn>
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

/** household store 모킹 */
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number | null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

function renderExpenseForm() {
  return render(
    <MemoryRouter>
      <ExpenseForm />
    </MemoryRouter>
  )
}

describe('ExpenseForm', () => {
  beforeEach(() => {
    mockAddToast = vi.fn()
    mockNavigate.mockClear()
  })

  describe('기본 렌더링', () => {
    it('지출 입력 제목을 표시한다', async () => {
      renderExpenseForm()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '지출 입력' })).toBeInTheDocument()
      })
    })

    it('목록으로 돌아가는 링크가 /expenses로 이동한다', async () => {
      renderExpenseForm()
      await waitFor(() => {
        const backLink = screen.getByRole('link')
        expect(backLink).toHaveAttribute('href', '/expenses')
      })
    })

    it('자연어 입력 모드가 기본 활성화된다', async () => {
      renderExpenseForm()
      await waitFor(() => {
        expect(screen.getByText('자연어로 지출 입력하기')).toBeInTheDocument()
      })
    })
  })

  describe('모드 전환', () => {
    it('직접 입력 버튼 클릭 시 폼 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderExpenseForm()

      await user.click(screen.getByText('직접 입력'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument()
      })
    })

    it('자연어 입력 버튼 클릭 시 자연어 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderExpenseForm()

      await user.click(screen.getByText('직접 입력'))
      await user.click(screen.getByText('자연어 입력'))

      await waitFor(() => {
        expect(screen.getByText('자연어로 지출 입력하기')).toBeInTheDocument()
      })
    })
  })

  describe('폼 입력 모드', () => {
    it('설명 없이 제출하면 에러 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      renderExpenseForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      await user.click(screen.getByText('저장하기'))

      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })

    it('금액 없이 제출하면 에러 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      renderExpenseForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('김치찌개'), '점심')
      await user.click(screen.getByText('저장하기'))

      expect(mockAddToast).toHaveBeenCalledWith('error', '금액은 0보다 큰 숫자여야 합니다')
    })

    it('정상 데이터로 지출을 저장한다', async () => {
      renderExpenseForm()

      fireEvent.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('김치찌개'), { target: { value: '점심' } })
      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '8000' } })

      const submitBtn = screen.getByText('저장하기')
      fireEvent.submit(submitBtn.closest('form')!)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('지출이 저장되었습니다'))
      })
    })

    /**
     * 폼 입력 모드에서는 날짜 변환을 올바르게 수행하는지 확인
     * date input (YYYY-MM-DD) → API 전송 시 T00:00:00 추가
     *
     * 기존 버그: 자연어 모드에서는 이 변환이 누락되어 LLM이 반환한
     * YYYY-MM-DD 형식이 그대로 POST되어 422 발생
     */
    it('날짜를 ISO datetime 형식(T00:00:00 포함)으로 API에 전송한다', async () => {
      let capturedBody: Record<string, unknown> | null = null

      server.use(
        http.post('/api/expenses', async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>
          return HttpResponse.json(
            {
              id: 99,
              amount: 8000,
              description: '점심',
              category_id: null,
              household_id: null,
              user_id: null,
              raw_input: null,
              memo: null,
              date: '2026-02-15T00:00:00',
              created_at: '2026-02-15T00:00:00',
              updated_at: '2026-02-15T00:00:00',
            },
            { status: 201 }
          )
        })
      )

      renderExpenseForm()

      fireEvent.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('김치찌개'), { target: { value: '점심' } })
      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '8000' } })
      // 날짜 input에 YYYY-MM-DD 형식으로 설정 (브라우저 date input 동작 시뮬레이션)
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2026-02-15' } })

      const submitBtn = screen.getByText('저장하기')
      fireEvent.submit(submitBtn.closest('form')!)

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
        // 폼 모드는 date에 T00:00:00을 붙여서 전송해야 함
        // (백엔드 Pydantic v2 datetime이 YYYY-MM-DD만 있는 문자열을 거부)
        expect(capturedBody!['date']).toContain('T')
      })
    })

    it('API 에러 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/expenses', () => {
          return HttpResponse.json({ detail: '서버 에러' }, { status: 500 })
        })
      )

      renderExpenseForm()

      fireEvent.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('김치찌개'), { target: { value: '점심' } })
      fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '8000' } })

      const submitBtn = screen.getByText('저장하기')
      fireEvent.submit(submitBtn.closest('form')!)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
      })
    })

    it('취소 버튼 클릭 시 /expenses로 이동한다', async () => {
      const user = userEvent.setup()
      renderExpenseForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('취소')).toBeInTheDocument())

      await user.click(screen.getByText('취소'))
      expect(mockNavigate).toHaveBeenCalledWith('/expenses')
    })
  })

  describe('자연어 입력 모드', () => {
    it('입력이 없으면 분석하기 버튼이 비활성화된다', async () => {
      renderExpenseForm()

      await waitFor(() => {
        const button = screen.getByText('분석하기')
        expect(button).toBeDisabled()
      })
    })

    it('LLM 파싱 결과를 프리뷰 카드로 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              {
                amount: 11680,
                description: '전기차충전',
                category: '교통',
                date: '2026-02-11',
                memo: '',
                type: 'expense',
              },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderExpenseForm()

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '2월11일 전기차충전 11680원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건 저장하기/)).toBeInTheDocument()
        expect(screen.getByDisplayValue('전기차충전')).toBeInTheDocument()
      })
    })

    /**
     * 핵심 버그 재현 테스트 (Session 4 버그)
     *
     * LLM이 date: "2026-02-11" (YYYY-MM-DD) 반환 시
     * handleConfirmSave가 item.date를 직접 POST /api/expenses/에 전송.
     * 백엔드 Pydantic v2는 이 형식을 거부하여 422 에러 발생.
     *
     * 올바른 동작: item.date에 T00:00:00을 붙여서 전송해야 함.
     */
    it('LLM 프리뷰 저장 시 날짜를 ISO datetime 형식(T00:00:00 포함)으로 전송한다', async () => {
      let capturedExpenseBody: Record<string, unknown> | null = null

      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              {
                amount: 11680,
                description: '전기차충전',
                category: '교통',
                date: '2026-02-11',  // LLM이 반환하는 YYYY-MM-DD 형식
                memo: '',
                type: 'expense',
              },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        }),
        http.post('/api/expenses', async ({ request }) => {
          capturedExpenseBody = await request.json() as Record<string, unknown>
          return HttpResponse.json(
            {
              id: 99,
              amount: 11680,
              description: '전기차충전',
              category_id: null,
              household_id: null,
              user_id: null,
              raw_input: '2월11일 전기차충전 11680원',
              memo: null,
              date: '2026-02-11T00:00:00',
              created_at: '2026-02-11T00:00:00',
              updated_at: '2026-02-11T00:00:00',
            },
            { status: 201 }
          )
        })
      )

      const user = userEvent.setup()
      renderExpenseForm()

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '2월11일 전기차충전 11680원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건 저장하기/)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/1건 저장하기/))

      await waitFor(() => {
        expect(capturedExpenseBody).not.toBeNull()
        // 핵심 검증: date 필드에 반드시 T가 포함되어야 함
        // T가 없으면 백엔드에서 422 에러 발생 (Pydantic v2 datetime 파싱 실패)
        expect(capturedExpenseBody!['date']).toContain('T')
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('지출이 저장되었습니다'))
      })
    })

    it('LLM 파싱 실패 시 info 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '지출 정보를 인식하지 못했습니다',
            parsed_expenses: null,
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderExpenseForm()

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '아무말대잔치')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('info', expect.any(String))
      })
    })

    it('프리뷰에서 다시 입력 버튼 클릭 시 프리뷰를 닫는다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              {
                amount: 8000,
                description: '김치찌개',
                category: '식비',
                date: '2026-02-15',
                memo: '',
                type: 'expense',
              },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderExpenseForm()

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '점심 김치찌개 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건 저장하기/)).toBeInTheDocument()
      })

      await user.click(screen.getByText('다시 입력'))

      await waitFor(() => {
        expect(screen.getByText('자연어로 지출 입력하기')).toBeInTheDocument()
        expect(screen.queryByText(/1건 저장하기/)).not.toBeInTheDocument()
      })
    })

    it('chat API 에러 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({ detail: '서버 오류' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderExpenseForm()

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '점심 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
      })
    })
  })
})
