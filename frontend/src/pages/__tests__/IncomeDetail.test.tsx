import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import IncomeDetail from '../IncomeDetail'
import { mockIncomes } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { ToastProvider } from '../../contexts/ToastContext'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number | null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

let mockAddToast: ReturnType<typeof vi.fn>

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

function renderIncomeDetail(incomeId = '1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/income/${incomeId}`]}>
        <Routes>
          <Route path="/income/:id" element={<IncomeDetail />} />
          <Route path="/income" element={<div>수입 목록 페이지</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  mockAddToast = vi.fn()
})

describe('IncomeDetail', () => {
  describe('기본 렌더링', () => {
    it('뒤로가기 링크를 표시한다', async () => {
      renderIncomeDetail()
      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: '목록으로' })
        expect(backLink).toHaveAttribute('href', '/income')
      })
    })

    it('로딩 중에는 스피너를 표시한다', () => {
      renderIncomeDetail()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('수입 정보 표시', () => {
    it('금액을 +원화로 표시한다', async () => {
      renderIncomeDetail()
      await waitFor(() => {
        expect(screen.getByText(`+₩${mockIncomes[0].amount.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('설명을 표시한다', async () => {
      renderIncomeDetail()
      await waitFor(() => {
        expect(screen.getByText(mockIncomes[0].description)).toBeInTheDocument()
      })
    })

    it('날짜를 YYYY.MM.DD 형식으로 표시한다', async () => {
      renderIncomeDetail()
      const formattedDate = mockIncomes[0].date.slice(0, 10).replace(/-/g, '.')
      await waitFor(() => {
        expect(screen.getByText(formattedDate)).toBeInTheDocument()
      })
    })

    it('원본 입력이 있으면 표시한다', async () => {
      renderIncomeDetail()
      await waitFor(() => {
        if (mockIncomes[0].raw_input) {
          expect(screen.getByText(mockIncomes[0].raw_input)).toBeInTheDocument()
        }
      })
    })
  })

  describe('수정 기능', () => {
    it('수정 버튼을 클릭하면 편집 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })
    })

    it('저장 버튼을 클릭하면 수정 사항을 저장한다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockIncomes[0].description)).toBeInTheDocument()
      })

      const descriptionInput = screen.getByDisplayValue(mockIncomes[0].description)
      await user.clear(descriptionInput)
      await user.type(descriptionInput, '수정된 수입')

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '저장되었습니다')
      })
    })

    it('편집 모드에서 금액 필드를 수정할 수 있다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        // 금액 input이 표시됨
        const amountInput = screen.getByLabelText('금액')
        expect(amountInput).toBeInTheDocument()
      })
    })

    it('편집 모드에서 날짜 필드를 수정할 수 있다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        const dateInput = screen.getByLabelText('날짜')
        expect(dateInput).toBeInTheDocument()
      })
    })

    it('편집 모드에서 메모 필드를 수정할 수 있다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        const memoInput = screen.getByLabelText('메모')
        expect(memoInput).toBeInTheDocument()
      })
    })

    it('편집 모드에서 통계 제외 토글을 조작할 수 있다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByText('차트/통계에서 제외')).toBeInTheDocument()
      })
    })

    it('편집 모드에서 카테고리 select가 표시된다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        const categorySelect = screen.getByLabelText('카테고리')
        expect(categorySelect).toBeInTheDocument()
      })
    })

    it('취소 버튼을 클릭하면 뷰 모드로 돌아간다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '취소' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })
    })

    it('빈 설명으로 저장하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockIncomes[0].description)).toBeInTheDocument()
      })

      await user.clear(screen.getByDisplayValue(mockIncomes[0].description))
      await user.click(screen.getByRole('button', { name: '저장' }))

      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })
  })

  describe('삭제 기능', () => {
    it('삭제 버튼을 클릭하면 삭제 확인 모달이 표시된다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '삭제' }))

      await waitFor(() => {
        expect(screen.getByText('수입 내역 삭제')).toBeInTheDocument()
        expect(screen.getByText(/정말로 이 수입 내역을 삭제하시겠습니까/)).toBeInTheDocument()
      })
    })

    it('삭제 모달에서 삭제를 클릭하면 수입을 삭제하고 목록으로 이동한다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '삭제' }))

      await waitFor(() => {
        expect(screen.getByText('수입 내역 삭제')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      await user.click(deleteButtons[deleteButtons.length - 1])

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '삭제되었습니다')
        expect(screen.getByText('수입 목록 페이지')).toBeInTheDocument()
      })
    })
  })

  describe('반복 거래 등록', () => {
    it('반복 거래 등록 버튼을 표시한다', async () => {
      renderIncomeDetail()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '반복 거래 등록' })).toBeInTheDocument()
      })
    })

    it('반복 거래 등록 버튼 클릭 시 모달이 열린다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '반복 거래 등록' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '반복 거래 등록' }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '반복 거래 등록' })).toBeInTheDocument()
      })
    })

    it('반복 거래 등록 시 성공 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '반복 거래 등록' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '반복 거래 등록' }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '반복 거래 등록' })).toBeInTheDocument()
      })

      // 모달 내의 submit 버튼 (type="submit") 클릭
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLElement
      await user.click(submitBtn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '반복 거래로 등록되었습니다')
      })
    })
  })

  describe('에러 처리', () => {
    it('존재하지 않는 수입 ID로 접근하면 에러 상태를 표시한다', async () => {
      server.use(
        http.get('/api/income/999', () => {
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
        }),
      )

      renderIncomeDetail('999')

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })
      expect(screen.getByText('다시 시도')).toBeInTheDocument()
    })

    it('403 에러로 저장 실패 시 권한 없음 toast를 표시한다', async () => {
      const user = userEvent.setup()
      renderIncomeDetail()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockIncomes[0].description)).toBeInTheDocument()
      })

      server.use(
        http.put('/api/income/:id', () => {
          return HttpResponse.json({ detail: '이 항목을 수정할 권한이 없습니다' }, { status: 403 })
        }),
      )

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '이 항목을 수정할 권한이 없습니다')
      })
    })
  })
})
