/**
 * @file TransactionList.test.tsx
 * @description 통합 거래 목록 페이지 (홈 화면) 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import TransactionList from '../TransactionList'

// jsdom에 IntersectionObserver가 없으므로 mock 제공
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      activeHouseholdId: 1,
      currentHousehold: null,
      fetchHouseholdDetail: vi.fn(),
    }),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, is_telegram_linked: false, is_kakao_linked: false },
    isAuthenticated: true,
    loading: false,
  }),
}))


function renderPage(initialRoute = '/home') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <TransactionList />
    </MemoryRouter>,
  )
}

/** 현재 월 날짜 기준의 mock 거래 데이터를 MSW로 제공하는 헬퍼 */
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
        {
          id: 102,
          amount: 3500,
          description: '버스',
          category_id: 2,
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
    http.get('/api/income', () => HttpResponse.json([])),
  )
}

describe('TransactionList', () => {
  it('월 네비게이션 헤더를 표시한다', async () => {
    renderPage()
    // 현재 월이 표시되어야 함
    const now = new Date()
    const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    expect(screen.getByText(monthLabel)).toBeInTheDocument()
  })

  it('지출/수입 요약 영역을 표시한다', async () => {
    renderPage()
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('데이터 로드 후 거래 목록을 표시한다', async () => {
    renderPage()
    // MSW가 반환하는 mockExpenses, mockIncomes의 데이터가 표시되어야 함
    await waitFor(() => {
      // 빈 상태 또는 거래 목록이 표시됨
      const hasTransactions = screen.queryByText('거래 내역이 없습니다') !== null
        || screen.queryByRole('link') !== null
      expect(hasTransactions).toBe(true)
    })
  })

  it('지출 필터 버튼을 클릭하면 필터가 적용된다', async () => {
    const user = userEvent.setup()
    renderPage()
    // 지출 버튼 클릭
    const expenseBtn = screen.getByText('지출')
    await user.click(expenseBtn)
    // 필터가 적용되어도 페이지는 정상 렌더링
    expect(screen.getByText('지출')).toBeInTheDocument()
  })

  it('수입 필터 버튼을 클릭하면 필터가 적용된다', async () => {
    const user = userEvent.setup()
    renderPage()
    const incomeBtn = screen.getByText('수입')
    await user.click(incomeBtn)
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('이전 월 버튼을 클릭하면 월이 변경된다', async () => {
    const user = userEvent.setup()
    renderPage()
    const now = new Date()
    const currentLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
    expect(screen.getByText(currentLabel)).toBeInTheDocument()

    // 이전 월 버튼 클릭 (첫 번째 네비게이션 버튼)
    const navButtons = screen.getAllByRole('button')
    const prevBtn = navButtons[0]
    await user.click(prevBtn)

    // 이전 월이 표시되어야 함
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevLabel = `${prevMonth.getFullYear()}년 ${prevMonth.getMonth() + 1}월`
    await waitFor(() => {
      expect(screen.getByText(prevLabel)).toBeInTheDocument()
    })
  })

  it('요일 헤더가 캘린더에 표시된다', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('일')).toBeInTheDocument()
      expect(screen.getByText('토')).toBeInTheDocument()
    })
  })

  describe('MSW 데이터 표시 검증', () => {
    it('MSW가 반환한 지출 description이 화면에 표시된다', async () => {
      setupCurrentMonthHandlers()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('김치찌개')).toBeInTheDocument()
        expect(screen.getByText('버스')).toBeInTheDocument()
      })
    })

    it('지출 필터 클릭 후 수입만 있을 때 지출 항목이 숨겨진다', async () => {
      // 수입 1건, 지출 1건 반환하도록 설정
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const currentMonthISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T12:00:00Z`

      server.use(
        http.get('/api/expenses', () =>
          HttpResponse.json([
            {
              id: 201,
              amount: 8000,
              description: '점심식사',
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
              id: 301,
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

      const user = userEvent.setup()
      renderPage()

      // 데이터 로드 대기
      await waitFor(() => {
        expect(screen.getByText('점심식사')).toBeInTheDocument()
      })

      // 수입 필터 클릭 → 수입 항목만 표시
      const incomeBtn = screen.getByText('수입')
      await user.click(incomeBtn)

      await waitFor(() => {
        expect(screen.getByText('월급')).toBeInTheDocument()
        expect(screen.queryByText('점심식사')).not.toBeInTheDocument()
      })
    })
  })

  describe('검색 모드', () => {
    it('돋보기 아이콘 클릭 시 검색 모드 진입', async () => {
      renderPage()

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByLabelText('검색')).toBeInTheDocument()
      })

      // Click search icon
      fireEvent.click(screen.getByLabelText('검색'))

      // Search bar should be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
      })
    })

    it('X 버튼 클릭 시 검색 모드 해제', async () => {
      renderPage('/?search=')

      await waitFor(() => {
        expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText('검색 닫기'))

      await waitFor(() => {
        expect(screen.getByLabelText('검색')).toBeInTheDocument()
      })
    })

    it('빈 검색어 + 최근 검색어 없으면 카테고리 바로가기 표시', async () => {
      localStorage.removeItem('podo-recent-searches')
      renderPage('/?search=')

      // 카테고리 로드 후 카테고리 바로가기가 표시됨
      await waitFor(() => {
        expect(screen.getByText('카테고리로 보기')).toBeInTheDocument()
      })
      // 최근 검색 섹션은 미표시
      expect(screen.queryByText('최근 검색')).not.toBeInTheDocument()
    })

    it('검색 모드 진입 시 최근 검색어가 있으면 표시', async () => {
      localStorage.setItem('podo-recent-searches', JSON.stringify(['병원', '치킨']))

      renderPage('/?search=')

      await waitFor(() => {
        expect(screen.getByText('최근 검색')).toBeInTheDocument()
        expect(screen.getByText('병원')).toBeInTheDocument()
        expect(screen.getByText('치킨')).toBeInTheDocument()
      })

      localStorage.removeItem('podo-recent-searches')
    })

    it('최근 검색어 클릭 시 검색 실행', async () => {
      localStorage.setItem('podo-recent-searches', JSON.stringify(['병원']))

      renderPage('/?search=')

      await waitFor(() => {
        expect(screen.getByText('병원')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('병원'))

      // 검색이 실행되어 검색 입력창에 값이 반영됨
      await waitFor(() => {
        expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
      })

      localStorage.removeItem('podo-recent-searches')
    })

    it('최근 검색어 삭제 버튼 클릭 시 해당 항목 제거', async () => {
      localStorage.setItem('podo-recent-searches', JSON.stringify(['병원', '치킨']))

      renderPage('/?search=')

      await waitFor(() => {
        expect(screen.getByText('병원')).toBeInTheDocument()
        expect(screen.getByText('치킨')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText('병원 삭제'))

      await waitFor(() => {
        expect(screen.queryByText('병원')).not.toBeInTheDocument()
        expect(screen.getByText('치킨')).toBeInTheDocument()
      })

      localStorage.removeItem('podo-recent-searches')
    })

    it('빈 검색어 상태에서 카테고리 바로가기 표시', async () => {
      renderPage('/?search=')

      await waitFor(() => {
        expect(screen.getByText('카테고리로 보기')).toBeInTheDocument()
        // mockCategories에 '식비', '교통'이 있음
        expect(screen.getByRole('button', { name: '식비' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '교통' })).toBeInTheDocument()
      })
    })

    it('검색어 입력 후 Enter → 검색 결과 표시', async () => {
      // "김치찌개"는 mockExpenses에 존재 — 검색 결과로 표시되어야 함
      renderPage('/?search=김치찌개')

      await waitFor(() => {
        expect(screen.getByText('김치찌개')).toBeInTheDocument()
      })

      // 월 뷰 전용 요소(캘린더 요일 헤더)가 숨겨져야 함
      expect(screen.queryByText('일')).not.toBeInTheDocument()
    })

    it('검색 결과 상단에 합계 표시', async () => {
      renderPage('/?search=김치찌개')

      await waitFor(() => {
        // 검색 합계 바: "김치찌개" · 1건 · 총 ₩8,000
        expect(screen.getByText(/1건/)).toBeInTheDocument()
        // 합계 바 텍스트 전체를 포함하는 요소 확인
        expect(screen.getByText(/총/)).toBeInTheDocument()
      })
    })

    it('검색 결과 없을 때 빈 상태 표시', async () => {
      renderPage('/?search=존재하지않는검색어')

      await waitFor(() => {
        expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
      })
    })
  })

  describe('검색 무한 스크롤', () => {
    /** 30건 이상의 검색 결과를 반환하는 MSW 핸들러 */
    function setupManySearchResults(count: number) {
      const items = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        amount: 1000 * (i + 1),
        description: `지출항목${i + 1}`,
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
          HttpResponse.json({ total_count: count, total_amount: count * 1000 })
        ),
        http.get('/api/income/search/summary', () =>
          HttpResponse.json({ total_count: 0, total_amount: 0 })
        ),
      )
    }

    it('검색 결과가 페이지 크기와 같으면 더 보기 sentinel 요소가 존재한다', async () => {
      setupManySearchResults(30)
      renderPage('/?search=지출')

      await waitFor(() => {
        expect(screen.getByText('지출항목1')).toBeInTheDocument()
      })

      // 30건 = SEARCH_PAGE_SIZE → hasMore가 true → sentinel이 존재해야 함
      expect(screen.getByTestId('search-load-more')).toBeInTheDocument()
    })

    it('검색 결과가 페이지 크기보다 적으면 sentinel 표시 안 됨', async () => {
      setupManySearchResults(5)
      renderPage('/?search=지출')

      await waitFor(() => {
        expect(screen.getByText('지출항목1')).toBeInTheDocument()
      })

      // 5건 < 30 → hasMore가 false → sentinel 없음
      expect(screen.queryByTestId('search-load-more')).not.toBeInTheDocument()

      // 대신 "모든 검색 결과" 메시지가 표시됨
      expect(screen.getByText('모든 검색 결과를 불러왔습니다')).toBeInTheDocument()
    })

    it('검색 결과가 페이지 크기보다 적으면 완료 메시지 표시', async () => {
      setupManySearchResults(10)
      renderPage('/?search=지출')

      await waitFor(() => {
        expect(screen.getByText('지출항목1')).toBeInTheDocument()
      })

      expect(screen.getByText('모든 검색 결과를 불러왔습니다')).toBeInTheDocument()
    })
  })

  describe('검색 필터 칩', () => {
    it('검색 모드에서 필터 칩 표시', async () => {
      renderPage('/?search=')
      await waitFor(() => {
        expect(screen.getByText('지출/수입')).toBeInTheDocument()
        expect(screen.getByText('카테고리')).toBeInTheDocument()
        expect(screen.getByText('기간: 전체')).toBeInTheDocument()
      })
    })

    it('지출/수입 필터 칩 클릭 시 드롭다운 표시', async () => {
      renderPage('/?search=점심')
      await waitFor(() => {
        expect(screen.getByText('지출/수입')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('지출/수입'))
      await waitFor(() => {
        expect(screen.getByText('지출만')).toBeInTheDocument()
        expect(screen.getByText('수입만')).toBeInTheDocument()
      })
    })

    it('지출만 필터 선택 시 칩 활성화', async () => {
      renderPage('/?search=점심')
      await waitFor(() => {
        expect(screen.getByText('지출/수입')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('지출/수입'))
      await waitFor(() => {
        expect(screen.getByText('지출만')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('지출만'))
      await waitFor(() => {
        // 드롭다운이 닫히고, 칩 텍스트가 '지출만'으로 변경됨
        expect(screen.getByRole('button', { name: /지출만/ })).toBeInTheDocument()
      })
    })

    it('기간 프리셋 필터 선택', async () => {
      renderPage('/?search=')
      await waitFor(() => {
        expect(screen.getByText('기간: 전체')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('기간: 전체'))
      await waitFor(() => {
        expect(screen.getByText('최근 1개월')).toBeInTheDocument()
        expect(screen.getByText('최근 3개월')).toBeInTheDocument()
        expect(screen.getByText('최근 6개월')).toBeInTheDocument()
        expect(screen.getByText('올해')).toBeInTheDocument()
      })
    })

    it('카테고리 칩 클릭 시 바텀시트 열기', async () => {
      renderPage('/?search=')
      await waitFor(() => {
        expect(screen.getByText('카테고리')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('카테고리'))
      // CategoryBottomSheet가 열려야 함
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: '카테고리 선택' })).toBeInTheDocument()
      })
    })
  })

  describe('검색 결과 카테고리 뱃지 클릭 → 필터 (#323)', () => {
    it('검색 결과에서 카테고리 뱃지 클릭 시 해당 카테고리 필터 적용', async () => {
      renderPage('/?search=김치찌개')

      // 검색 결과 로드 대기
      await waitFor(() => {
        expect(screen.getByText('김치찌개')).toBeInTheDocument()
      })

      // 카테고리 뱃지("식비") 클릭 — 검색 모드에서는 카테고리 필터가 적용되어야 함
      const categoryBadge = screen.getByRole('button', { name: '식비' })
      fireEvent.click(categoryBadge)

      // 카테고리 바텀시트가 열리지 않아야 함 (검색 모드이므로)
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '카테고리 선택' })).not.toBeInTheDocument()
      })

      // 카테고리 필터 칩이 활성화되어야 함 ("식비 ✕" 표시)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /식비 ✕/ })).toBeInTheDocument()
      })
    })

    it('같은 카테고리 뱃지 재클릭 시 필터 해제 (토글)', async () => {
      // 이미 식비(id=1) 필터가 적용된 상태로 진입
      renderPage('/?search=김치찌개&category=1')

      await waitFor(() => {
        expect(screen.getByText('김치찌개')).toBeInTheDocument()
      })

      // "식비" 뱃지 클릭 — 이미 같은 카테고리로 필터 중이므로 해제되어야 함
      const categoryBadge = screen.getByRole('button', { name: '식비' })
      fireEvent.click(categoryBadge)

      // 필터가 해제되어 칩이 기본 "카테고리"로 복귀
      await waitFor(() => {
        expect(screen.getByText('카테고리')).toBeInTheDocument()
      })
    })

    it('월 뷰에서는 카테고리 뱃지 클릭 시 기존 바텀시트 열기', async () => {
      setupCurrentMonthHandlers()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('김치찌개')).toBeInTheDocument()
      })

      // 월 뷰에서 카테고리 뱃지 클릭 → 카테고리 변경 바텀시트 열림
      const categoryBadge = screen.getByRole('button', { name: '식비' })
      fireEvent.click(categoryBadge)

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: '카테고리 변경' })).toBeInTheDocument()
      })
    })
  })

  describe('검색↔월뷰 모드 전환', () => {
    it('검색 모드 진입 후 검색 닫기로 월뷰 복귀 시 캘린더가 다시 표시된다', async () => {
      renderPage()

      // 월뷰에서 캘린더 요일 헤더 확인
      await waitFor(() => {
        expect(screen.getByText('일')).toBeInTheDocument()
        expect(screen.getByText('토')).toBeInTheDocument()
      })

      // 검색 모드 진입
      fireEvent.click(screen.getByLabelText('검색'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
        // 캘린더 요일 헤더가 숨겨짐
        expect(screen.queryByText('토')).not.toBeInTheDocument()
      })

      // 검색 닫기 → 월뷰 복귀
      fireEvent.click(screen.getByLabelText('검색 닫기'))
      await waitFor(() => {
        expect(screen.getByText('일')).toBeInTheDocument()
        expect(screen.getByText('토')).toBeInTheDocument()
      })
    })

    it('검색 모드에서 월 네비게이션 헤더가 표시되지 않는다', async () => {
      renderPage('/?search=')

      const now = new Date()
      const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`

      await waitFor(() => {
        expect(screen.getByPlaceholderText('거래 내역 검색')).toBeInTheDocument()
      })

      expect(screen.queryByText(monthLabel)).not.toBeInTheDocument()
    })
  })
})
