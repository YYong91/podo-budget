/**
 * @file IncomeForm.test.tsx
 * @description IncomeForm 수입 입력 페이지 테스트
 * 자연어 입력 모드, 폼 입력 모드, 카테고리 필터링을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import IncomeForm from '../IncomeForm'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { mockIncomeCategoriesAll } from '../../mocks/fixtures'

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

function renderIncomeForm() {
  return render(
    <MemoryRouter>
      <IncomeForm />
    </MemoryRouter>
  )
}

describe('IncomeForm', () => {
  beforeEach(() => {
    mockAddToast = vi.fn()
    mockNavigate.mockClear()
    // 수입 카테고리 포함한 전체 카테고리를 반환
    server.use(
      http.get('/api/categories', () => {
        return HttpResponse.json(mockIncomeCategoriesAll)
      })
    )
  })

  describe('기본 렌더링', () => {
    it('수입 입력 제목을 표시한다', async () => {
      renderIncomeForm()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '수입 입력' })).toBeInTheDocument()
      })
    })

    it('자연어 입력 모드가 기본 활성화되어 있다', async () => {
      renderIncomeForm()
      await waitFor(() => {
        expect(screen.getByText('자연어로 수입 입력하기')).toBeInTheDocument()
      })
    })

    it('뒤로가기 링크가 /income으로 이동한다', async () => {
      renderIncomeForm()
      await waitFor(() => {
        const backLink = screen.getByRole('link')
        expect(backLink).toHaveAttribute('href', '/income')
      })
    })
  })

  describe('모드 전환', () => {
    it('직접 입력 버튼 클릭 시 폼 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('월급')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('3500000')).toBeInTheDocument()
      })
    })

    it('자연어 입력 버튼 클릭 시 자연어 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))
      await user.click(screen.getByText('자연어 입력'))

      await waitFor(() => {
        expect(screen.getByText('자연어로 수입 입력하기')).toBeInTheDocument()
      })
    })
  })

  describe('폼 입력 모드', () => {
    it('필수 필드 검증: 설명 없이 제출하면 에러', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('3500000')).toBeInTheDocument())

      // 설명 없이 바로 제출 → 설명 검증이 먼저 동작
      await user.click(screen.getByText('저장하기'))

      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })

    it('필수 필드 검증: 금액 없이 제출하면 에러', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('월급')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('월급'), '2월 월급')
      await user.click(screen.getByText('저장하기'))

      expect(mockAddToast).toHaveBeenCalledWith('error', '금액은 0보다 큰 숫자여야 합니다')
    })

    it('수입 카테고리(income/both)만 드롭다운에 표시된다', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        const options = within(select).getAllByRole('option')
        const optionTexts = options.map((o) => o.textContent)
        // income: 급여, 부수입 / both: 쇼핑 / 미분류 기본 옵션
        expect(optionTexts).toContain('급여')
        expect(optionTexts).toContain('부수입')
        expect(optionTexts).toContain('쇼핑') // type=both
        // expense only 카테고리는 표시되지 않아야 한다
        expect(optionTexts).not.toContain('식비')
        expect(optionTexts).not.toContain('교통')
      })
    })

    it('성공적으로 수입을 저장한다', async () => {
      renderIncomeForm()

      fireEvent.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('3500000')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('월급'), { target: { value: '2월 월급' } })
      fireEvent.change(screen.getByPlaceholderText('3500000'), { target: { value: '3500000' } })

      // submit 버튼을 통해 form submit 트리거
      const submitBtn = screen.getByText('저장하기')
      fireEvent.submit(submitBtn.closest('form')!)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '수입이 저장되었습니다')
      })
    })

    it('취소 버튼 클릭 시 /income으로 이동한다', async () => {
      const user = userEvent.setup()
      renderIncomeForm()

      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('취소')).toBeInTheDocument())

      await user.click(screen.getByText('취소'))
      expect(mockNavigate).toHaveBeenCalledWith('/income')
    })

    it('API 에러 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/income', () => {
          return HttpResponse.json({ detail: '서버 에러' }, { status: 500 })
        })
      )

      renderIncomeForm()

      fireEvent.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('3500000')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('월급'), { target: { value: '수입 테스트' } })
      fireEvent.change(screen.getByPlaceholderText('3500000'), { target: { value: '100000' } })

      const submitBtn = screen.getByText('저장하기')
      fireEvent.submit(submitBtn.closest('form')!)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
      })
    })
  })

  describe('자연어 입력 모드', () => {
    it('입력이 없으면 분석하기 버튼이 비활성화된다', async () => {
      renderIncomeForm()

      await waitFor(() => {
        const button = screen.getByText('분석하기')
        expect(button).toBeDisabled()
      })
    })

    it('수입 파싱 결과를 프리뷰 카드로 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 3500000, description: '월급', category: '급여', date: '2026-02-01', memo: '', type: 'income' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderIncomeForm()

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '이번 달 월급 350만원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건의 수입을 인식했습니다/)).toBeInTheDocument()
        expect(screen.getByDisplayValue('3500000')).toBeInTheDocument()
      })
    })

    it('지출/수입 혼합 시 지출 안내 메시지를 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 3500000, description: '월급', category: '급여', date: '2026-02-01', memo: '', type: 'income' },
              { amount: 8000, description: '점심', category: '식비', date: '2026-02-01', memo: '', type: 'expense' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderIncomeForm()

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '월급 350만원 점심 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/지출로 분류된 1건/)).toBeInTheDocument()
      })
    })

    it('모두 지출로 분류되면 안내 메시지를 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 8000, description: '점심', category: '식비', date: '2026-02-01', memo: '', type: 'expense' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderIncomeForm()

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '점심 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          'info',
          '입력한 내용이 모두 지출로 분류되었습니다. 지출 입력 페이지를 이용해주세요.'
        )
      })
    })

    it('프리뷰에서 다시 입력 클릭 시 프리뷰가 사라진다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 3500000, description: '월급', category: '급여', date: '2026-02-01', memo: '', type: 'income' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderIncomeForm()

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '월급 350만원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건의 수입을 인식했습니다/)).toBeInTheDocument()
      })

      await user.click(screen.getByText('다시 입력'))
      await waitFor(() => {
        expect(screen.queryByText(/1건의 수입을 인식했습니다/)).not.toBeInTheDocument()
        expect(screen.getByText('자연어로 수입 입력하기')).toBeInTheDocument()
      })
    })

    it('프리뷰 확인 후 저장한다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 500000, description: '부업 수입', category: '부수입', date: '2026-02-10', memo: '', type: 'income' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderIncomeForm()

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '부업 50만원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건 저장하기/)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/1건 저장하기/))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '1건의 수입이 저장되었습니다')
      })
    })
  })
})
