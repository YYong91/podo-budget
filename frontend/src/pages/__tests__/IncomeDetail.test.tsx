import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import IncomeDetail from '../IncomeDetail'

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

describe('IncomeDetail', () => {
  it('TransactionDetail을 type="income"로 렌더링한다', async () => {
    render(
      <MemoryRouter initialEntries={['/income/1']}>
        <Routes>
          <Route path="/income/:id" element={<IncomeDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('수입 내역')).toBeInTheDocument()
    })
  })
})
