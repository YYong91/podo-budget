import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ExpenseDetail from '../ExpenseDetail'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

describe('ExpenseDetail', () => {
  it('TransactionDetail을 type="expense"로 렌더링한다', async () => {
    render(
      <MemoryRouter initialEntries={['/expenses/1']}>
        <Routes>
          <Route path="/expenses/:id" element={<ExpenseDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('지출 내역')).toBeInTheDocument()
    })
  })
})
