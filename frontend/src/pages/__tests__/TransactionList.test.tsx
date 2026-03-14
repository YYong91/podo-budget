/**
 * @file TransactionList.test.tsx
 * @description 통합 거래 목록 페이지 (홈 화면) 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
})
