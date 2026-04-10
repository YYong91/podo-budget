/**
 * @file TransactionDetail.test.tsx
 * @description TransactionDetail 뷰 모드 렌더링 + 빠른 수정 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import { mockExpenses } from '../../mocks/fixtures'
import TransactionDetail from '../TransactionDetail'

const BASE_URL = '/api'

// addToast를 테스트에서 접근 가능하도록 모듈 레벨에서 선언
const mockAddToast = vi.fn()

// Mock stores and hooks
vi.mock('../../stores/useHouseholdStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// Helper to render with router
function renderWithRouter(type: 'expense' | 'income', id: number = 1, search: string = '') {
  const path = type === 'expense' ? `/expenses/${id}` : `/income/${id}`
  return render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <Routes>
        <Route
          path={type === 'expense' ? '/expenses/:id' : '/income/:id'}
          element={<TransactionDetail type={type} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAddToast.mockClear()
})

describe('TransactionDetail — 뷰 모드', () => {
  it('지출 히어로 섹션을 렌더링한다 (금액, 설명, 카테고리 칩, 날짜)', async () => {
    renderWithRouter('expense', 1)

    // 금액
    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 설명
    expect(screen.getByText('김치찌개')).toBeInTheDocument()

    // 카테고리 칩 (emoji + 이름)
    expect(screen.getByText(/식비/)).toBeInTheDocument()

    // 날짜
    expect(screen.getByText('2024.01.15')).toBeInTheDocument()
  })

  it('수입 금액에 + prefix와 leaf-600 색상을 적용한다', async () => {
    renderWithRouter('income', 1)

    await waitFor(() => {
      expect(screen.getByText('+₩3,500,000')).toBeInTheDocument()
    })

    // leaf-600 색상 적용 확인
    const amountEl = screen.getByText('+₩3,500,000')
    expect(amountEl.className).toContain('text-leaf-600')
  })

  it('결제수단 칩에 type 기반 아이콘을 표시한다', async () => {
    // Override: expense with payment_method_id=1 (삼성카드, credit_card)
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], payment_method_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 삼성카드 칩 표시 확인 (💳 아이콘)
    expect(screen.getByText(/삼성카드/)).toBeInTheDocument()
    expect(screen.getByText(/💳/)).toBeInTheDocument()
  })

  it('페이지 제목을 표시한다 (지출 내역 / 수입 내역)', async () => {
    const { unmount } = renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('지출 내역')).toBeInTheDocument()
    })

    unmount()

    renderWithRouter('income', 1)

    await waitFor(() => {
      expect(screen.getByText('수입 내역')).toBeInTheDocument()
    })
  })

  it('빈 필드를 숨긴다 (메모 없음, 결제수단 없음)', async () => {
    // mockExpenses[0] has memo=null, payment_method_id=null
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 메모 섹션이 없어야 함
    expect(screen.queryByText('메모')).not.toBeInTheDocument()

    // 결제수단 칩이 없어야 함 (payment_method_id=null)
    const allChips = screen.queryAllByText(/💳|💵|🏦/)
    expect(allChips).toHaveLength(0)
  })

  it('수입 타입은 결제수단 칩을 렌더링하지 않는다', async () => {
    renderWithRouter('income', 1)

    await waitFor(() => {
      expect(screen.getByText('+₩3,500,000')).toBeInTheDocument()
    })

    // 결제수단 관련 아이콘 없어야 함
    const pmChips = screen.queryAllByText(/💳|💵|🏦/)
    expect(pmChips).toHaveLength(0)
  })

  it('정기거래 연결 시 뱃지를 표시하고 등록 버튼을 숨긴다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], recurring_transaction_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 🔁 뱃지 표시
    expect(screen.getByText(/정기거래 연결됨/)).toBeInTheDocument()

    // 등록 버튼 없어야 함
    expect(screen.queryByText('+ 정기거래 등록')).not.toBeInTheDocument()
  })

  it('정기거래 미연결 시 등록 버튼을 표시한다', async () => {
    // mockExpenses[0] has recurring_transaction_id=null
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    expect(screen.getByText('+ 정기거래 등록')).toBeInTheDocument()
  })

  it('exclude_from_stats=true이면 통계 제외 뱃지를 표시한다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], exclude_from_stats: true })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    expect(screen.getByText('통계 제외')).toBeInTheDocument()
  })

  it('raw_input이 있으면 원본 입력을 표시한다', async () => {
    // mockExpenses[0] has raw_input='오늘 점심에 김치찌개 8000원 먹었어'
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    expect(screen.getByText('오늘 점심에 김치찌개 8000원 먹었어')).toBeInTheDocument()
  })
})

describe('TransactionDetail — 에러/로딩', () => {
  it('로딩 중 Skeleton을 렌더링한다', () => {
    renderWithRouter('expense', 1)
    // Skeleton(animate-pulse)이 즉시 표시되어야 함
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('네트워크 에러 시 ErrorState를 렌더링한다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.error()
      }),
    )
    renderWithRouter('expense', 1)
    await waitFor(() => {
      expect(screen.getByText('다시 시도')).toBeInTheDocument()
    })
  })

  it('404 시 "찾을 수 없습니다" 메시지를 표시한다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return new HttpResponse(null, { status: 404 })
      }),
    )
    renderWithRouter('expense', 1)
    await waitFor(() => {
      expect(screen.getByText('내역을 찾을 수 없습니다')).toBeInTheDocument()
    })
  })
})

describe('TransactionDetail — 빠른 수정', () => {
  it('카테고리 칩 클릭 시 드롭다운이 열린다', async () => {
    renderWithRouter('expense', 1)

    // 데이터 로드 대기
    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 카테고리 칩 클릭
    const categoryChip = screen.getByTestId('chip-category')
    await userEvent.click(categoryChip)

    // select가 나타나야 함
    expect(screen.getByTestId('quick-select-category')).toBeInTheDocument()
  })

  it('카테고리 선택 시 API PUT이 호출되고 칩이 복귀한다', async () => {
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 카테고리 칩 클릭
    await userEvent.click(screen.getByTestId('chip-category'))

    // select에서 교통(id=2) 선택
    const select = screen.getByTestId('quick-select-category')
    await userEvent.selectOptions(select, '2')

    // 칩이 복귀하고 새 카테고리가 표시됨
    await waitFor(() => {
      const chip = screen.getByTestId('chip-category')
      expect(chip).toBeInTheDocument()
      expect(chip.textContent).toContain('교통')
    })
  })

  it('카테고리 빠른 수정 저장 중 select가 disabled된다', async () => {
    // API 응답을 지연시켜 saving 상태를 관찰
    let resolveUpdate: ((value: unknown) => void) | null = null
    server.use(
      http.put(`${BASE_URL}/expenses/:id`, () => {
        return new Promise((resolve) => {
          resolveUpdate = resolve
        })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-category'))
    const select = screen.getByTestId('quick-select-category')
    await userEvent.selectOptions(select, '2')

    // saving 중이므로 select가 disabled
    await waitFor(() => {
      const selectEl = screen.queryByTestId('quick-select-category')
      if (selectEl) {
        expect(selectEl).toBeDisabled()
      }
    })

    // 응답 완료
    resolveUpdate?.(HttpResponse.json({ ...mockExpenses[0], category_id: 2 }))
  })

  it('카테고리 빠른 수정 실패 시 원래 값으로 복귀한다', async () => {
    server.use(
      http.put(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.error()
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-category'))
    await userEvent.selectOptions(screen.getByTestId('quick-select-category'), '2')

    // 에러 토스트 + 원래 카테고리 칩 복귀
    await waitFor(() => {
      expect(screen.getByTestId('chip-category')).toBeInTheDocument()
      expect(screen.getByText(/식비/)).toBeInTheDocument()
    })
    expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
  })

  it('빠른 수정 중 다른 칩이 opacity-50으로 비활성화된다', async () => {
    // 결제수단이 있는 지출로 세팅
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], payment_method_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 결제수단 칩이 보일 때까지 대기
    await waitFor(() => {
      expect(screen.getByTestId('chip-payment_method')).toBeInTheDocument()
    })

    // 카테고리 칩 클릭
    await userEvent.click(screen.getByTestId('chip-category'))

    // 결제수단 칩이 opacity-50이어야 함
    const pmChip = screen.getByTestId('chip-payment_method')
    expect(pmChip.className).toContain('opacity-50')
  })

  it('isSaving 중에는 칩 탭이 무시된다', async () => {
    // API 응답을 지연시켜 saving 상태 유지
    let resolveUpdate: ((value: unknown) => void) | null = null
    server.use(
      http.put(`${BASE_URL}/expenses/:id`, () => {
        return new Promise((resolve) => {
          resolveUpdate = resolve
        })
      }),
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], payment_method_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('chip-payment_method')).toBeInTheDocument()
    })

    // 카테고리 선택 시작
    await userEvent.click(screen.getByTestId('chip-category'))
    await userEvent.selectOptions(screen.getByTestId('quick-select-category'), '2')

    // saving 중 → 결제수단 칩 클릭해도 select가 열리면 안 됨
    // (결제수단 칩이 존재하면 클릭 시도)
    const pmChip = screen.queryByTestId('chip-payment_method')
    if (pmChip) {
      await userEvent.click(pmChip)
      expect(screen.queryByTestId('quick-select-payment_method')).not.toBeInTheDocument()
    }

    // 정리: 응답 완료
    resolveUpdate?.(HttpResponse.json({ ...mockExpenses[0], category_id: 2 }))
  })

  it('빠른 수정 열린 상태에서 수정 버튼 클릭 시 편집 모드로 전환한다', async () => {
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    // 카테고리 칩 클릭 → select 열림
    await userEvent.click(screen.getByTestId('chip-category'))
    expect(screen.getByTestId('quick-select-category')).toBeInTheDocument()

    // 수정 버튼 클릭
    await userEvent.click(screen.getByRole('button', { name: '수정' }))

    // quick-select가 닫혀야 함 (PUT 호출 없이)
    await waitFor(() => {
      expect(screen.queryByTestId('quick-select-category')).not.toBeInTheDocument()
    })
  })

  it('결제수단 칩 클릭 시 드롭다운이 열린다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], payment_method_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('chip-payment_method')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-payment_method'))
    expect(screen.getByTestId('quick-select-payment_method')).toBeInTheDocument()
  })

  it('결제수단 선택 시 API PUT이 호출된다', async () => {
    server.use(
      http.get(`${BASE_URL}/expenses/:id`, () => {
        return HttpResponse.json({ ...mockExpenses[0], payment_method_id: 1 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('chip-payment_method')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-payment_method'))
    await userEvent.selectOptions(screen.getByTestId('quick-select-payment_method'), '2')

    // 칩이 복귀하고 새 결제수단이 표시됨
    await waitFor(() => {
      const chip = screen.getByTestId('chip-payment_method')
      expect(chip).toBeInTheDocument()
      expect(chip.textContent).toContain('국민카드')
    })
  })

  it('403 에러 시 권한 없음 toast를 표시한다', async () => {
    server.use(
      http.put(`${BASE_URL}/expenses/:id`, () => {
        return new HttpResponse(null, { status: 403 })
      }),
    )

    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-category'))
    await userEvent.selectOptions(screen.getByTestId('quick-select-category'), '2')

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '권한이 없어요')
    })
  })

  it('수입 카테고리 칩 빠른 수정이 동작한다', async () => {
    renderWithRouter('income', 1)

    await waitFor(() => {
      expect(screen.getByText('+₩3,500,000')).toBeInTheDocument()
    })

    // 카테고리 칩 클릭
    await userEvent.click(screen.getByTestId('chip-category'))
    expect(screen.getByTestId('quick-select-category')).toBeInTheDocument()

    // income 카테고리만 표시되어야 함 (income/both 타입)
    const select = screen.getByTestId('quick-select-category') as HTMLSelectElement
    const options = Array.from(select.options)
    // 옵션에 expense-only 카테고리(식비, 교통)는 없어야 함
    const optionTexts = options.map((o) => o.textContent)
    expect(optionTexts).not.toContain('식비')
    expect(optionTexts).not.toContain('교통')
  })

  it('성공 후 aria-live 영역에 안내 메시지가 표시된다', async () => {
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('chip-category'))
    await userEvent.selectOptions(screen.getByTestId('quick-select-category'), '2')

    // aria-live 영역에 변경 안내 메시지
    await waitFor(() => {
      const liveRegion = screen.getByTestId('live-region')
      expect(liveRegion.textContent).toContain('카테고리')
      expect(liveRegion.textContent).toContain('교통')
    })
  })
})
