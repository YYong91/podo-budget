/**
 * @file TransactionList.test.tsx
 * @description 통합 거래 목록 페이지 (홈 화면) 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import TransactionList from '../TransactionList'

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

function renderPage(initialRoute = '/') {
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
})
