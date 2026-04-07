/**
 * @file MonthlyView.test.tsx
 * @description MonthlyView 컴포넌트 단위 테스트 — 캘린더, 요약, 거래 리스트 렌더링 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  useHouseholdStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      activeHouseholdId: 1,
      currentHousehold: null,
      fetchHouseholdDetail: vi.fn(),
    }),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, is_telegram_linked: false, is_kakao_linked: false },
    isAuthenticated: true,
    loading: false,
  }),
}))

function renderPage(initialRoute = '/home') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <TransactionList />
      </MemoryRouter>
    </QueryClientProvider>,
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
  beforeEach(() => {
    localStorage.removeItem('podo-calendar-collapsed')
  })

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

    const categoryBtns = screen.getAllByRole('button', { name: '카테고리 변경' })
    fireEvent.click(categoryBtns[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '카테고리 변경' })).toBeInTheDocument()
    })
  })

  it('거래가 없으면 빈 상태 메시지를 표시한다', async () => {
    server.use(
      http.get('/api/expenses', () => HttpResponse.json([])),
      http.get('/api/income', () => HttpResponse.json([])),
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('거래 내역이 없습니다')).toBeInTheDocument()
    })
  })

  it('수입 필터 클릭 시 지출 항목이 숨겨진다', async () => {
    setupCurrentMonthHandlers()
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })

    // 수입 필터 클릭
    await user.click(screen.getByText('수입'))

    await waitFor(() => {
      expect(screen.queryByText('김치찌개')).not.toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })
  })

  it('필터 두 번 클릭 시 전체 모드로 복귀한다', async () => {
    setupCurrentMonthHandlers()
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })

    // 지출 필터 클릭 (지출만 표시)
    await user.click(screen.getByText('지출'))

    await waitFor(() => {
      expect(screen.queryByText('월급')).not.toBeInTheDocument()
    })

    // 다시 클릭 (전체로 복귀)
    await user.click(screen.getByText('지출'))

    await waitFor(() => {
      expect(screen.getByText('김치찌개')).toBeInTheDocument()
      expect(screen.getByText('월급')).toBeInTheDocument()
    })
  })

  it('다음 월 버튼 클릭 시 월이 변경된다', async () => {
    const user = userEvent.setup()
    renderPage()
    const now = new Date()
    const currentLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    expect(screen.getByText(currentLabel)).toBeInTheDocument()

    // 다음 월 버튼 클릭 (두 번째 네비게이션 버튼)
    const navButtons = screen.getAllByRole('button')
    await user.click(navButtons[1])

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextLabel = `${nextMonth.getFullYear()}년 ${nextMonth.getMonth() + 1}월`
    await waitFor(() => {
      expect(screen.getByText(nextLabel)).toBeInTheDocument()
    })
  })

  it('지출 필터 적용 후 빈 상태 시 필터별 메시지를 표시한다', async () => {
    // 수입만 있는 상태
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const currentMonthISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T12:00:00Z`

    server.use(
      http.get('/api/expenses', () => HttpResponse.json([])),
      http.get('/api/income', () =>
        HttpResponse.json([
          { id: 201, amount: 3000000, description: '월급', category_id: null, raw_input: null, memo: null, household_id: 1, user_id: null, date: currentMonthISO, created_at: currentMonthISO, updated_at: currentMonthISO },
        ])
      ),
    )

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('월급')).toBeInTheDocument()
    })

    await user.click(screen.getByText('지출'))

    await waitFor(() => {
      expect(screen.getByText('지출 내역이 없습니다')).toBeInTheDocument()
    })
  })

  it('웰컴 카드가 신규 사용자에게 표시된다', async () => {
    // 웰컴 카드 dismissed 상태 초기화
    localStorage.removeItem('podo-welcome-dismissed')

    server.use(
      http.get('/api/expenses', () => HttpResponse.json([])),
      http.get('/api/income', () => HttpResponse.json([])),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('시작 가이드')).toBeInTheDocument()
      expect(screen.getByText('첫 거래를 입력해보세요')).toBeInTheDocument()
    })

    // cleanup
    localStorage.removeItem('podo-welcome-dismissed')
  })

  it('웰컴 카드 닫기 버튼 클릭 시 카드가 사라진다', async () => {
    localStorage.removeItem('podo-welcome-dismissed')

    server.use(
      http.get('/api/expenses', () => HttpResponse.json([])),
      http.get('/api/income', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('시작 가이드')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('시작 가이드 닫기'))

    await waitFor(() => {
      expect(screen.queryByText('시작 가이드')).not.toBeInTheDocument()
    })

    // localStorage에 저장 확인
    expect(localStorage.getItem('podo-welcome-dismissed')).toBe('true')

    // cleanup
    localStorage.removeItem('podo-welcome-dismissed')
  })

  it('월간 지출 히어로 카드를 표시한다', async () => {
    setupCurrentMonthHandlers()
    renderPage()
    await waitFor(() => {
      // HeroSummary label — "N월 지출"
      const now = new Date()
      expect(screen.getByText(`${now.getMonth() + 1}월 지출`)).toBeInTheDocument()
    })
  })

  it('예산이 설정되면 프로그레스 바가 표시된다', async () => {
    setupCurrentMonthHandlers()
    server.use(
      http.get('/api/budgets/total-budget', () =>
        HttpResponse.json({ total_monthly_budget: 500000 })
      ),
    )
    renderPage()
    await waitFor(() => {
      expect(document.querySelector('[role="progressbar"]')).not.toBeNull()
    })
  })

  describe('달력 접기/펼치기', () => {
    it('최초 방문 시 달력이 펼쳐져 있다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('일')).toBeInTheDocument()
        expect(screen.getByText('토')).toBeInTheDocument()
      })
      expect(screen.getByText('접기')).toBeInTheDocument()
    })

    it('접기 버튼 클릭 시 주간 스트립으로 전환되고 펼치기 아이콘이 표시된다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('접기')).toBeInTheDocument()
      })

      await user.click(screen.getByText('접기'))

      await waitFor(() => {
        expect(screen.getByTestId('calendar-expand')).toBeInTheDocument()
        expect(screen.queryByText('접기')).not.toBeInTheDocument()
      })
    })

    it('펼치기 아이콘 클릭 시 달력이 다시 표시된다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('접기')).toBeInTheDocument()
      })

      await user.click(screen.getByText('접기'))
      await waitFor(() => {
        expect(screen.getByTestId('calendar-expand')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('calendar-expand'))
      await waitFor(() => {
        expect(screen.getByText('접기')).toBeInTheDocument()
        expect(screen.getByText('일')).toBeInTheDocument()
      })
    })

    it('접힌 상태가 localStorage에 저장된다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('접기')).toBeInTheDocument()
      })

      await user.click(screen.getByText('접기'))

      expect(localStorage.getItem('podo-calendar-collapsed')).toBe('true')
    })

    it('localStorage에 접힌 상태가 있으면 주간 스트립으로 시작한다', async () => {
      localStorage.setItem('podo-calendar-collapsed', 'true')
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('calendar-expand')).toBeInTheDocument()
        expect(screen.queryByText('접기')).not.toBeInTheDocument()
      })
    })

    it('캘린더 접힌 상태에서 주간 스트립이 표시된다', async () => {
      localStorage.setItem('podo-calendar-collapsed', 'true')
      renderPage()
      await waitFor(() => {
        const weeks = document.querySelectorAll('[data-testid="calendar-week"]')
        expect(weeks.length).toBe(1)
      })
    })
  })
})
