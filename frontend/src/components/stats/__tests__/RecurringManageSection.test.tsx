import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurringManageSection from '../RecurringManageSection'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

describe('RecurringManageSection', () => {
  it('활성 건수와 이번 달 총액을 표시한다', () => {
    render(<RecurringManageSection activeCount={5} monthlyExpenseTotal={450000} />)
    expect(screen.getByText(/활성 5건/)).toBeInTheDocument()
    expect(screen.getByText(/₩45만/)).toBeInTheDocument()
  })

  it('관리하기 버튼 클릭 시 정기거래 페이지로 이동한다', async () => {
    render(<RecurringManageSection activeCount={3} monthlyExpenseTotal={170000} />)
    await userEvent.click(screen.getByText(/관리하기/))
    expect(mockNavigate).toHaveBeenCalledWith('/recurring')
  })

  it('활성 건수 0이면 안내 문구를 표시한다', () => {
    render(<RecurringManageSection activeCount={0} monthlyExpenseTotal={0} />)
    expect(screen.getByText(/정기거래.*없/)).toBeInTheDocument()
  })
})
