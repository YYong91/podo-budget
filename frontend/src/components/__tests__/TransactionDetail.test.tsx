/**
 * @file TransactionDetail.test.tsx
 * @description TransactionDetail 뷰 모드 렌더링 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import { mockExpenses } from '../../mocks/fixtures'
import TransactionDetail from '../TransactionDetail'

const BASE_URL = '/api'

// Mock stores and hooks
vi.mock('../../stores/useHouseholdStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
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
    expect(screen.getByText(/정기거래/)).toBeInTheDocument()

    // 등록 버튼 없어야 함
    expect(screen.queryByText('정기거래 등록')).not.toBeInTheDocument()
  })

  it('정기거래 미연결 시 등록 버튼을 표시한다', async () => {
    // mockExpenses[0] has recurring_transaction_id=null
    renderWithRouter('expense', 1)

    await waitFor(() => {
      expect(screen.getByText('₩8,000')).toBeInTheDocument()
    })

    expect(screen.getByText('정기거래 등록')).toBeInTheDocument()
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
