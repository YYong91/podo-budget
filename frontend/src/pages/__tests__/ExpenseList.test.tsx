/**
 * @file ExpenseList.test.tsx
 * @description ExpenseList 페이지 테스트
 * 지출 목록, 필터링, 정렬, 페이지네이션을 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import ExpenseList from '../ExpenseList'
import { mockExpenses } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

function renderExpenseList() {
  return render(
    <MemoryRouter>
      <ExpenseList />
    </MemoryRouter>
  )
}

describe('ExpenseList', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '지출 목록' })).toBeInTheDocument()
      })
    })

    it('필터 입력 필드를 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        // label 텍스트로 확인 (htmlFor 속성이 없으므로 getByLabelText 대신 getByText 사용)
        expect(screen.getByText('시작일')).toBeInTheDocument()
        expect(screen.getByText('종료일')).toBeInTheDocument()
        expect(screen.getByText('카테고리')).toBeInTheDocument()
      })
    })
  })

  describe('지출 목록 표시', () => {
    it('지출 목록을 테이블로 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
      })
    })

    it('테이블 헤더를 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /날짜/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /내용/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /금액/i })).toBeInTheDocument()
      })
    })

    it('모든 지출 항목을 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        mockExpenses.forEach((expense) => {
          expect(screen.getByText(expense.description)).toBeInTheDocument()
        })
      })
    })

    it('지출 금액을 한국 원화 형식으로 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        expect(screen.getByText(`₩${mockExpenses[0].amount.toLocaleString('ko-KR')}`)).toBeInTheDocument()
      })
    })

    it('지출 날짜를 YYYY.MM.DD 형식으로 표시한다', async () => {
      renderExpenseList()

      // 테이블이 먼저 로드될 때까지 대기
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const formattedDate = mockExpenses[0].date.slice(0, 10).replace(/-/g, '.')
      // 같은 날짜가 여러 개 있을 수 있으므로 getAllByText 사용
      const dateElements = screen.getAllByText(formattedDate)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })

  describe('필터링', () => {
    it('시작일 필터를 적용할 수 있다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByText('시작일')).toBeInTheDocument()
      })

      // type="date" input 찾기
      const inputs = document.querySelectorAll('input[type="date"]')
      const startDateInput = inputs[0] as HTMLInputElement

      await user.type(startDateInput, '2024-01-15')

      // 필터가 적용되었는지 확인 (페이지가 0으로 리셋됨)
      await waitFor(() => {
        expect(startDateInput).toHaveValue('2024-01-15')
      })
    })

    it('카테고리 필터를 적용할 수 있다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByText('카테고리')).toBeInTheDocument()
      })

      // select 찾기 (카테고리 label 아래의 select)
      const selects = document.querySelectorAll('select')
      const categorySelect = selects[0] as HTMLSelectElement

      await user.selectOptions(categorySelect, '1')

      await waitFor(() => {
        expect(categorySelect).toHaveValue('1')
      })
    })

    it('필터 초기화 버튼을 클릭하면 모든 필터가 리셋된다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByText('시작일')).toBeInTheDocument()
      })

      const inputs = document.querySelectorAll('input[type="date"]')
      const startDateInput = inputs[0] as HTMLInputElement

      await user.type(startDateInput, '2024-01-15')

      const resetButton = screen.getByRole('button', { name: /필터 초기화/i })
      await user.click(resetButton)

      await waitFor(() => {
        expect(startDateInput).toHaveValue('')
      })
    })
  })

  describe('정렬', () => {
    it('날짜 컬럼 헤더를 클릭하면 정렬된다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /날짜/i })).toBeInTheDocument()
      })

      const dateHeader = screen.getByRole('columnheader', { name: /날짜/i })
      await user.click(dateHeader)

      // 정렬 아이콘이 표시되는지 확인
      expect(within(dateHeader).getByText(/▼|▲/)).toBeInTheDocument()
    })

    it('금액 컬럼 헤더를 클릭하면 정렬된다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /금액/i })).toBeInTheDocument()
      })

      const amountHeader = screen.getByRole('columnheader', { name: /금액/i })
      await user.click(amountHeader)

      // 정렬 아이콘이 표시되는지 확인
      expect(within(amountHeader).getByText(/▼|▲/)).toBeInTheDocument()
    })

    it('같은 컬럼을 다시 클릭하면 정렬 방향이 반전된다', async () => {
      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /날짜/i })).toBeInTheDocument()
      })

      const dateHeader = screen.getByRole('columnheader', { name: /날짜/i })

      // 첫 번째 클릭 (이미 desc가 기본값이므로 ▼가 표시됨)
      await waitFor(() => {
        expect(within(dateHeader).getByText('▼')).toBeInTheDocument()
      })

      // 두 번째 클릭 (asc로 변경)
      await user.click(dateHeader)
      await waitFor(() => {
        expect(within(dateHeader).getByText('▲')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('페이지네이션', () => {
    it('페이지네이션 버튼을 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '이전' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument()
      })
    })

    it('첫 페이지에서는 이전 버튼이 비활성화된다', async () => {
      renderExpenseList()
      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: '이전' })
        expect(prevButton).toBeDisabled()
      })
    })

    it('현재 페이지 번호를 표시한다', async () => {
      renderExpenseList()
      await waitFor(() => {
        expect(screen.getByText(/페이지 1/i)).toBeInTheDocument()
      })
    })

    it('다음 버튼을 클릭하면 다음 페이지로 이동한다', async () => {
      // 충분한 데이터를 반환하도록 MSW handler override
      const manyExpenses = Array.from({ length: 25 }, (_, i) => ({
        ...mockExpenses[0],
        id: i + 1,
        description: `지출 ${i + 1}`,
      }))

      server.use(
        http.get('/api/expenses', ({ request }) => {
          const url = new URL(request.url)
          const skip = Number(url.searchParams.get('skip')) || 0
          const limit = Number(url.searchParams.get('limit')) || 20
          const paginated = manyExpenses.slice(skip, skip + limit)
          return HttpResponse.json(paginated)
        })
      )

      const user = userEvent.setup()
      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument()
      })

      // 첫 페이지 확인
      expect(screen.getByText('페이지 1')).toBeInTheDocument()

      const nextButton = screen.getByRole('button', { name: '다음' })
      // 다음 버튼이 활성화되어 있는지 확인 (20개 이상이므로 활성화됨)
      expect(nextButton).not.toBeDisabled()

      await user.click(nextButton)

      // 페이지 변경 확인
      await waitFor(() => {
        expect(screen.getByText('페이지 2')).toBeInTheDocument()
      })
    })
  })

  describe('빈 상태', () => {
    it('지출이 없으면 빈 상태를 표시한다', async () => {
      server.use(
        http.get('/api/expenses', () => {
          return HttpResponse.json([])
        })
      )

      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByText('지출 내역이 없습니다')).toBeInTheDocument()
      })
    })
  })

  describe('에러 상태', () => {
    it('API 에러 발생 시 에러 상태를 표시한다', async () => {
      server.use(
        http.get('/api/expenses', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      renderExpenseList()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })
    })
  })

  describe('링크', () => {
    it('지출 항목을 클릭하면 상세 페이지로 이동한다', async () => {
      renderExpenseList()

      await waitFor(() => {
        const link = screen.getByRole('link', { name: mockExpenses[0].description })
        expect(link).toHaveAttribute('href', `/expenses/${mockExpenses[0].id}`)
      })
    })
  })
})
