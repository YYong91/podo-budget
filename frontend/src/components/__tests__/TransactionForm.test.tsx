/**
 * @file TransactionForm.test.tsx
 * @description TransactionForm 통합 컴포넌트 테스트
 * type='expense'와 type='income'에 따라 올바른 라우트, 색상, OCR 유무가 결정되는지 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TransactionForm from '../TransactionForm'
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
    selector({ activeHouseholdId: 1 }),
}))

function renderForm(type: 'expense' | 'income') {
  return render(
    <MemoryRouter>
      <TransactionForm type={type} />
    </MemoryRouter>
  )
}

describe('TransactionForm', () => {
  beforeEach(() => {
    mockAddToast = vi.fn()
    mockNavigate.mockClear()
  })

  describe('type="expense" 기본 렌더링', () => {
    it('뒤로가기 링크가 /expenses로 설정된다', async () => {
      renderForm('expense')
      await waitFor(() => {
        const backLink = screen.getByRole('link')
        expect(backLink).toHaveAttribute('href', '/expenses')
      })
    })

    it('자연어 입력 라벨이 "말하듯이 지출 입력하기"이다', async () => {
      renderForm('expense')
      await waitFor(() => {
        expect(screen.getByText('말하듯이 지출 입력하기')).toBeInTheDocument()
      })
    })

    it('이미지 탭(OCR)이 표시된다', async () => {
      renderForm('expense')
      await waitFor(() => {
        expect(screen.getByText('이미지')).toBeInTheDocument()
      })
    })

    it('폼 모드에서 placeholder가 "김치찌개"이다', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument()
      })
    })
  })

  describe('type="income" 기본 렌더링', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(mockIncomeCategoriesAll)
        })
      )
    })

    it('뒤로가기 링크가 /income으로 설정된다', async () => {
      renderForm('income')
      await waitFor(() => {
        const backLink = screen.getByRole('link')
        expect(backLink).toHaveAttribute('href', '/income')
      })
    })

    it('자연어 입력 라벨이 "말하듯이 수입 입력하기"이다', async () => {
      renderForm('income')
      await waitFor(() => {
        expect(screen.getByText('말하듯이 수입 입력하기')).toBeInTheDocument()
      })
    })

    it('이미지 탭(OCR)이 표시되지 않는다', async () => {
      renderForm('income')
      await waitFor(() => {
        expect(screen.getByText('간편 입력')).toBeInTheDocument()
      })
      expect(screen.queryByText('이미지')).not.toBeInTheDocument()
    })

    it('폼 모드에서 placeholder가 "월급"이다', async () => {
      const user = userEvent.setup()
      renderForm('income')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('월급')).toBeInTheDocument()
      })
    })

    it('수입 카테고리(income/both)만 드롭다운에 표시된다', async () => {
      const user = userEvent.setup()
      renderForm('income')
      await user.click(screen.getByText('직접 입력'))

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        const options = within(select).getAllByRole('option')
        const optionTexts = options.map((o) => o.textContent)
        expect(optionTexts).toContain('급여')
        expect(optionTexts).toContain('부수입')
        expect(optionTexts).toContain('쇼핑') // type=both
        expect(optionTexts).not.toContain('식비')
        expect(optionTexts).not.toContain('교통')
      })
    })
  })

  describe('폼 입력 공통 검증', () => {
    it('expense: 설명 없이 제출하면 에러 토스트', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())
      await user.click(screen.getByText('저장하기'))
      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })

    it('income: 금액 없이 제출하면 에러 토스트', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(mockIncomeCategoriesAll)
        })
      )
      const user = userEvent.setup()
      renderForm('income')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('월급')).toBeInTheDocument())
      await user.type(screen.getByPlaceholderText('월급'), '2월 월급')
      await user.click(screen.getByText('저장하기'))
      expect(mockAddToast).toHaveBeenCalledWith('error', '금액은 0보다 큰 숫자여야 합니다')
    })
  })

  describe('expense OCR 모드', () => {
    it('이미지 탭 클릭 시 OCR 업로드 UI가 표시된다', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('이미지'))
      await waitFor(() => {
        expect(screen.getByText('결제 화면 이미지 인식')).toBeInTheDocument()
        expect(screen.getByText('갤러리에서 선택')).toBeInTheDocument()
      })
    })
  })

  describe('자연어 입력 공통', () => {
    it('expense: 파싱 결과 프리뷰가 올바르게 표시된다', async () => {
      server.use(
        http.post('/api/chat', () => {
          return HttpResponse.json({
            message: '파싱 완료',
            parsed_expenses: [
              { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-19', memo: '', type: 'expense' },
            ],
            parsed_items: null,
            expenses_created: null,
            incomes_created: null,
            insights: null,
          })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')

      const textarea = screen.getByPlaceholderText(/오늘 점심/)
      await user.type(textarea, '점심 김치찌개 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/1건의 지출을 인식했습니다/)).toBeInTheDocument()
        expect(screen.getByText('지출 #1')).toBeInTheDocument()
      })
    })

    it('income: 지출 혼합 시 안내 메시지가 표시된다', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(mockIncomeCategoriesAll)
        }),
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
      renderForm('income')

      const textarea = screen.getByPlaceholderText(/월급/)
      await user.type(textarea, '월급 350만원 점심 8000원')
      await user.click(screen.getByText('분석하기'))

      await waitFor(() => {
        expect(screen.getByText(/지출로 분류된 1건/)).toBeInTheDocument()
      })
    })
  })

  describe('폼 입력 성공 제출', () => {
    it('expense: 올바른 폼 데이터로 제출 시 성공 토스트 + 네비게이션', async () => {
      server.use(
        http.post('/api/expenses', () => {
          return HttpResponse.json({ id: 99, amount: 10000, description: '테스트' }, { status: 201 })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('10000'), '10000')
      await user.type(screen.getByPlaceholderText('김치찌개'), '테스트 지출')
      await user.click(screen.getByText('저장하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '지출이 저장되었습니다')
      })
    })

    it('income: 올바른 폼 데이터로 제출 시 성공 토스트', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(mockIncomeCategoriesAll)
        }),
        http.post('/api/income', () => {
          return HttpResponse.json({ id: 99, amount: 3500000, description: '월급' }, { status: 201 })
        })
      )

      const user = userEvent.setup()
      renderForm('income')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('월급')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('3500000'), '3500000')
      await user.type(screen.getByPlaceholderText('월급'), '2월 월급')
      await user.click(screen.getByText('저장하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '수입이 저장되었습니다')
      })
    })

    it('expense: 폼 제출 실패 시 에러 토스트', async () => {
      server.use(
        http.post('/api/expenses', () => {
          return HttpResponse.json({ detail: '실패' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('10000'), '10000')
      await user.type(screen.getByPlaceholderText('김치찌개'), '테스트')
      await user.click(screen.getByText('저장하기'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '지출 저장에 실패했습니다')
      })
    })

    it('expense: 날짜 비어있으면 에러 토스트', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      await user.type(screen.getByPlaceholderText('10000'), '10000')
      await user.type(screen.getByPlaceholderText('김치찌개'), '테스트')
      // 날짜 필드를 비우기
      const dateInput = screen.getByLabelText(/날짜/)
      await user.clear(dateInput)
      await user.click(screen.getByText('저장하기'))

      expect(mockAddToast).toHaveBeenCalledWith('error', '날짜를 선택해주세요')
    })
  })

  describe('폼 카테고리 생성', () => {
    it('+ 새 카테고리 클릭 시 카테고리 생성 입력 필드가 표시된다', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('+ 새 카테고리')).toBeInTheDocument())

      await user.click(screen.getByText('+ 새 카테고리'))
      expect(screen.getByPlaceholderText('새 카테고리 이름')).toBeInTheDocument()
    })

    it('카테고리 생성 취소 버튼 클릭 시 입력 필드가 사라진다', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('+ 새 카테고리')).toBeInTheDocument())

      await user.click(screen.getByText('+ 새 카테고리'))
      expect(screen.getByPlaceholderText('새 카테고리 이름')).toBeInTheDocument()
      // 카테고리 입력 필드 옆의 취소 버튼을 찾음 — 같은 div 안에 위치
      const categoryInput = screen.getByPlaceholderText('새 카테고리 이름')
      const categoryRow = categoryInput.closest('.flex')!
      const cancelBtn = categoryRow.querySelector('button:last-child') as HTMLButtonElement
      await user.click(cancelBtn)
      expect(screen.queryByPlaceholderText('새 카테고리 이름')).not.toBeInTheDocument()
    })

    it('카테고리 생성 성공 시 토스트가 표시된다', async () => {
      server.use(
        http.post('/api/categories', () => {
          return HttpResponse.json({ id: 100, name: '테스트 카테고리' }, { status: 201 })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('+ 새 카테고리')).toBeInTheDocument())

      await user.click(screen.getByText('+ 새 카테고리'))
      await user.type(screen.getByPlaceholderText('새 카테고리 이름'), '테스트 카테고리')
      await user.click(screen.getByText('추가'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '"테스트 카테고리" 카테고리가 추가되었습니다')
      })
    })

    it('카테고리 생성 실패 시 에러 토스트', async () => {
      server.use(
        http.post('/api/categories', () => {
          return HttpResponse.json({ detail: '실패' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('+ 새 카테고리')).toBeInTheDocument())

      await user.click(screen.getByText('+ 새 카테고리'))
      await user.type(screen.getByPlaceholderText('새 카테고리 이름'), '실패 테스트')
      await user.click(screen.getByText('추가'))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '카테고리 생성에 실패했습니다')
      })
    })
  })

  describe('OCR 모드 파일 업로드', () => {
    it('OCR 파일 업로드 성공 시 프리뷰 카드가 표시된다', async () => {
      server.use(
        http.post('/api/expenses/ocr', () => {
          return HttpResponse.json({
            parsed_expenses: [
              { amount: 4500, description: '아메리카노', category: '식비', date: '2026-03-19', memo: '', type: 'expense' },
            ],
          })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('이미지'))

      await waitFor(() => {
        expect(screen.getByText('결제 화면 이미지 인식')).toBeInTheDocument()
      })

      // 파일 input에 파일 업로드 시뮬레이션
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/1건의 지출을 인식했습니다/)).toBeInTheDocument()
      })
    })

    it('OCR 파일 업로드 실패 시 에러 토스트', async () => {
      server.use(
        http.post('/api/expenses/ocr', () => {
          return HttpResponse.json({ detail: '실패' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('이미지'))

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', 'OCR 처리에 실패했습니다')
      })
    })

    it('OCR 결과가 빈 배열이면 안내 메시지가 표시된다', async () => {
      server.use(
        http.post('/api/expenses/ocr', () => {
          return HttpResponse.json({
            parsed_expenses: [],
            message: '결제 정보를 인식하지 못했습니다',
          })
        })
      )

      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('이미지'))

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('info', '결제 정보를 인식하지 못했습니다')
      })
    })
  })

  describe('모드 전환', () => {
    it('자연어→폼→OCR 모드 전환이 동작한다', async () => {
      const user = userEvent.setup()
      renderForm('expense')

      // 기본: 자연어 모드
      expect(screen.getByText('말하듯이 지출 입력하기')).toBeInTheDocument()

      // 폼 모드
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByPlaceholderText('김치찌개')).toBeInTheDocument())

      // OCR 모드
      await user.click(screen.getByText('이미지'))
      await waitFor(() => expect(screen.getByText('결제 화면 이미지 인식')).toBeInTheDocument())

      // 다시 자연어
      await user.click(screen.getByText('간편 입력'))
      await waitFor(() => expect(screen.getByText('말하듯이 지출 입력하기')).toBeInTheDocument())
    })
  })

  describe('취소 버튼 라우팅', () => {
    it('expense: 취소 클릭 시 /expenses로 이동', async () => {
      const user = userEvent.setup()
      renderForm('expense')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('취소')).toBeInTheDocument())
      await user.click(screen.getByText('취소'))
      expect(mockNavigate).toHaveBeenCalledWith('/expenses')
    })

    it('income: 취소 클릭 시 /income으로 이동', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(mockIncomeCategoriesAll)
        })
      )
      const user = userEvent.setup()
      renderForm('income')
      await user.click(screen.getByText('직접 입력'))
      await waitFor(() => expect(screen.getByText('취소')).toBeInTheDocument())
      await user.click(screen.getByText('취소'))
      expect(mockNavigate).toHaveBeenCalledWith('/income')
    })
  })
})
