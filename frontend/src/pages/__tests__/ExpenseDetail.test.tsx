/**
 * @file ExpenseDetail.test.tsx
 * @description ExpenseDetail 페이지 테스트
 * 지출 상세 정보 표시, 수정, 삭제 기능을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import ExpenseDetail from '../ExpenseDetail'
import { mockExpenses, mockCategories } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { ToastProvider } from '../../contexts/ToastContext'

/**
 * addToast 함수를 모킹하기 위한 변수
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
 * ExpenseDetail을 ToastProvider와 함께 특정 ID로 렌더링
 */
function renderExpenseDetail(expenseId = '1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/expenses/${expenseId}`]}>
        <Routes>
          <Route path="/expenses/:id" element={<ExpenseDetail />} />
          <Route path="/expenses" element={<div>지출 목록 페이지</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

/**
 * 각 테스트 전에 mockAddToast 초기화
 */
beforeEach(() => {
  mockAddToast = vi.fn()
})

describe('ExpenseDetail', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '지출 상세' })).toBeInTheDocument()
      })
    })

    it('뒤로가기 링크를 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: '목록으로' })
        expect(backLink).toHaveAttribute('href', '/expenses')
      })
    })

    it('로딩 중에는 스피너를 표시한다', () => {
      renderExpenseDetail()
      // 로딩 스피너는 animate-spin 클래스를 가진 div로 렌더링됨
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('지출 정보 표시', () => {
    it('금액을 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        expect(screen.getByText(`₩${mockExpenses[0].amount.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('설명을 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        expect(screen.getByText(mockExpenses[0].description)).toBeInTheDocument()
      })
    })

    it('카테고리를 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        const category = mockCategories.find((c) => c.id === mockExpenses[0].category_id)
        expect(screen.getByText(category!.name)).toBeInTheDocument()
      })
    })

    it('날짜를 YYYY.MM.DD 형식으로 표시한다', async () => {
      renderExpenseDetail()
      const formattedDate = mockExpenses[0].date.slice(0, 10).replace(/-/g, '.')
      await waitFor(() => {
        expect(screen.getByText(formattedDate)).toBeInTheDocument()
      })
    })

    it('원본 입력이 있으면 표시한다', async () => {
      renderExpenseDetail()
      await waitFor(() => {
        if (mockExpenses[0].raw_input) {
          expect(screen.getByText(mockExpenses[0].raw_input)).toBeInTheDocument()
        }
      })
    })
  })

  describe('수정 기능', () => {
    it('수정 버튼을 클릭하면 편집 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })
    })

    it('편집 모드에서 금액 입력 필드가 표시된다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        const amountInput = screen.getByDisplayValue(mockExpenses[0].amount)
        expect(amountInput).toBeInTheDocument()
        expect(amountInput).toHaveAttribute('type', 'number')
      })
    })

    it('편집 모드에서 설명 입력 필드가 표시된다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        const descriptionInput = screen.getByDisplayValue(mockExpenses[0].description)
        expect(descriptionInput).toBeInTheDocument()
      })
    })

    it('취소 버튼을 클릭하면 편집 모드를 종료한다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: '취소' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })
    })

    it('저장 버튼을 클릭하면 수정 사항을 저장한다', async () => {
      const user = userEvent.setup()

      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockExpenses[0].description)).toBeInTheDocument()
      })

      const descriptionInput = screen.getByDisplayValue(mockExpenses[0].description)
      await user.clear(descriptionInput)
      await user.type(descriptionInput, '수정된 설명')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '저장되었습니다')
      })
    })

    it('빈 설명으로 저장하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()

      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockExpenses[0].description)).toBeInTheDocument()
      })

      const descriptionInput = screen.getByDisplayValue(mockExpenses[0].description)
      await user.clear(descriptionInput)

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })
  })

  describe('삭제 기능', () => {
    it('삭제 버튼을 클릭하면 삭제 확인 모달이 표시된다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: '삭제' })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('지출 내역 삭제')).toBeInTheDocument()
        expect(screen.getByText(/정말로 이 지출 내역을 삭제하시겠습니까/i)).toBeInTheDocument()
      })
    })

    it('삭제 모달에서 취소를 클릭하면 모달이 닫힌다', async () => {
      const user = userEvent.setup()
      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: '삭제' })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('지출 내역 삭제')).toBeInTheDocument()
      })

      // 모달 내의 취소 버튼 클릭
      const cancelButtons = screen.getAllByRole('button', { name: '취소' })
      const modalCancelButton = cancelButtons[cancelButtons.length - 1]
      await user.click(modalCancelButton)

      await waitFor(() => {
        expect(screen.queryByText('지출 내역 삭제')).not.toBeInTheDocument()
      })
    })

    it('삭제 모달에서 삭제를 클릭하면 지출을 삭제하고 목록 페이지로 이동한다', async () => {
      const user = userEvent.setup()

      renderExpenseDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: '삭제' })
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('지출 내역 삭제')).toBeInTheDocument()
      })

      // 모달 내의 삭제 버튼 클릭
      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      const modalDeleteButton = deleteButtons[deleteButtons.length - 1]
      await user.click(modalDeleteButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '삭제되었습니다')
        expect(screen.getByText('지출 목록 페이지')).toBeInTheDocument()
      })
    })
  })

  describe('에러 처리', () => {
    it('존재하지 않는 지출 ID로 접근하면 에러 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/expenses/999', () => {
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
        })
      )

      renderExpenseDetail('999')

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '지출 내역을 불러오는데 실패했습니다')
        expect(screen.getByText('지출 내역을 찾을 수 없습니다')).toBeInTheDocument()
      })
    })
  })
})
