/**
 * @file SearchMode.test.tsx
 * @description SearchMode 컴포넌트 단위 테스트 — 검색 바, 필터 칩, 최근 검색, 결과 리스트 렌더링 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

function renderWithSearch(initialRoute = '/?search=') {
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

describe('SearchMode 컴포넌트', () => {
  beforeEach(() => {
    localStorage.removeItem('podo-recent-searches')
  })

  it('검색 모드에서 검색 바와 닫기 버튼을 렌더링한다', async () => {
    renderWithSearch()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
      expect(screen.getByLabelText('검색 닫기')).toBeInTheDocument()
    })
  })

  it('필터 칩 3종(지출/수입, 카테고리, 기간)을 렌더링한다', async () => {
    renderWithSearch()
    await waitFor(() => {
      expect(screen.getByText('지출/수입')).toBeInTheDocument()
      expect(screen.getByText('카테고리')).toBeInTheDocument()
      expect(screen.getByText('기간: 전체')).toBeInTheDocument()
    })
  })

  it('검색 결과가 있으면 합계 바를 표시한다', async () => {
    renderWithSearch('/?search=김치찌개')
    await waitFor(() => {
      expect(screen.getByText(/1건/)).toBeInTheDocument()
      expect(screen.getByText(/총/)).toBeInTheDocument()
    })
  })

  it('검색 결과가 없으면 빈 상태를 표시한다', async () => {
    renderWithSearch('/?search=존재하지않는항목')
    await waitFor(() => {
      expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
    })
  })

  it('빈 검색어 + 카테고리가 있으면 카테고리 바로가기를 표시한다', async () => {
    renderWithSearch()
    await waitFor(() => {
      expect(screen.getByText('카테고리로 보기')).toBeInTheDocument()
    })
  })

  it('최근 검색어가 있으면 최근 검색 섹션을 표시한다', async () => {
    localStorage.setItem('podo-recent-searches', JSON.stringify(['커피', '점심']))
    renderWithSearch()
    await waitFor(() => {
      expect(screen.getByText('최근 검색')).toBeInTheDocument()
      expect(screen.getByText('커피')).toBeInTheDocument()
      expect(screen.getByText('점심')).toBeInTheDocument()
    })
    localStorage.removeItem('podo-recent-searches')
  })

  it('지출/수입 드롭다운을 열고 옵션을 선택할 수 있다', async () => {
    renderWithSearch('/?search=테스트')
    await waitFor(() => {
      expect(screen.getByText('지출/수입')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('지출/수입'))
    await waitFor(() => {
      expect(screen.getByText('지출만')).toBeInTheDocument()
      expect(screen.getByText('수입만')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('지출만'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /지출만/ })).toBeInTheDocument()
    })
  })

  it('기간 드롭다운을 열고 옵션을 선택할 수 있다', async () => {
    renderWithSearch('/?search=')
    await waitFor(() => {
      expect(screen.getByText('기간: 전체')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('기간: 전체'))
    await waitFor(() => {
      expect(screen.getByText('최근 1개월')).toBeInTheDocument()
    })
  })

  it('무한 스크롤 sentinel이 30건 결과에서 표시된다', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      amount: 1000 * (i + 1),
      description: `검색항목${i + 1}`,
      category_id: 1,
      raw_input: null,
      memo: null,
      household_id: 1,
      user_id: null,
      exclude_from_stats: false,
      date: '2024-01-15T12:00:00Z',
      created_at: '2024-01-15T12:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    }))

    server.use(
      http.get('/api/expenses', ({ request }) => {
        const url = new URL(request.url)
        const skip = Number(url.searchParams.get('skip')) || 0
        const limit = Number(url.searchParams.get('limit')) || 30
        return HttpResponse.json(items.slice(skip, skip + limit))
      }),
      http.get('/api/income', () => HttpResponse.json([])),
      http.get('/api/expenses/search/summary', () =>
        HttpResponse.json({ total_count: 30, total_amount: 30000 })
      ),
      http.get('/api/income/search/summary', () =>
        HttpResponse.json({ total_count: 0, total_amount: 0 })
      ),
    )

    renderWithSearch('/?search=검색')
    await waitFor(() => {
      expect(screen.getByText('검색항목1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('search-load-more')).toBeInTheDocument()
  })
})
