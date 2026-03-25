/**
 * @file MonthlyView.test.tsx
 * @description MonthlyView 컴포넌트 단위 테스트 — 캘린더, 요약, 거래 리스트 렌더링 검증
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import TransactionList from '../../../pages/TransactionList'

// IntersectionObserver mock
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, is_telegram_linked: false, is_kakao_linked: false },
    isAuthenticated: true,
    loading: false,
  }),
}))

function renderPage(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <TransactionList />
    </MemoryRouter>,
  )
}

function setupCurrentMonthHandlers() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const currentMonthISO = `${todayDate}T12:00:00Z`

  server.use(
    http.get('/api/expenses', () =>
      HttpResponse.json([
        {
          id: 101,
          amount: 8000,
          description: '김치찌개',
          category_id: 1,
          raw_input: null,
          memo: null,
          household_id: 1,
          user_id: null,
          exclude_from_stats: false,
          date: currentMonthISO,
          created_at: currentMonthISO,
          updated_at: currentMonthISO,
        },
      ])
    ),
    http.get('/api/income', () =>
      HttpResponse.json([
        {
          id: 201,
          amount: 3000000,
          description: '월급',
          category_id: null,
          raw_input: null,
          memo: null,
          household_id: 1,
          user_id: null,
          date: currentMonthISO,
          created_at: currentMonthISO,
          updated_at: currentMonthISO,
        },
      ])
    ),
  )
}

describe('MonthlyView 컴포넌트', () => {
  it('월 네비게이션 헤더를 표시한다', () => {
    renderPage()
    const now = new Date()
    const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    expect(screen.getByText(monthLabel)).toBeInTheDocument()
  })

  it('지출/수입 요약 영역을 표시한다', () => {
    renderPage()
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('미니 캘린더(요일 헤더)를 표시한다', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('일')).toBeInTheDocument()
      expect(screen.getByText('토')).toBeInTheDocument()
    })
  })

  it('검색 아이콘 버튼을 표시한다', () => {
    renderPage()
    expect(screen.getByLabelText('검색')).toBeInTheDocument()
  })

  it('데이터 로드 후 거래 항목을 표시한다', async () => {
    setupCurrentMonthHandlers()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })
  })

  it('이전 월 버튼 클릭 시 월이 변경된다', async () => {
    const user = userEvent.setup()
    renderPage()
    const now = new Date()
    const currentLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    expect(screen.getByText(currentLabel)).toBeInTheDocument()

    const navButtons = screen.getAllByRole('button')
    await user.click(navButtons[0])

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevLabel = `${prevMonth.getFullYear()}년 ${prevMonth.getMonth() + 1}월`
    await waitFor(() => {
      expect(screen.getByText(prevLabel)).toBeInTheDocument()
    })
  })

  it('지출 필터 클릭 시 수입 항목이 숨겨진다', async () => {
    setupCurrentMonthHandlers()
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })

    // 지출 필터 클릭
    await user.click(screen.getByText('지출'))

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.queryByText('월급')).not.toBeInTheDocument()
    })
  })

  it('카테고리 뱃지 클릭 시 바텀시트가 열린다', async () => {
    setupCurrentMonthHandlers()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
    })

    const categoryBadge = screen.getByRole('button', { name: '식비' })
    fireEvent.click(categoryBadge)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '카테고리 변경' })).toBeInTheDocument()
    })
  })
})
