import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PendingRecurring from '../PendingRecurring'
import type { RecurringTransaction } from '../../types'

const mockItems: RecurringTransaction[] = [
  {
    id: 1,
    description: '넷플릭스 구독',
    amount: 17000,
    type: 'expense',
    frequency: 'monthly',
    next_due_date: '2026-03-14',
    is_active: true,
    category_id: null,
    household_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 2,
    description: '월급',
    amount: 3000000,
    type: 'income',
    frequency: 'monthly',
    next_due_date: '2026-03-25',
    is_active: true,
    category_id: null,
    household_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

describe('PendingRecurring', () => {
  it('빈 배열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <PendingRecurring items={[]} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('반복 거래 항목을 렌더링한다', () => {
    render(
      <PendingRecurring items={mockItems} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(screen.getByText('넷플릭스 구독')).toBeInTheDocument()
    expect(screen.getByText('월급')).toBeInTheDocument()
  })

  it('등록 버튼 클릭 시 onExecute가 호출된다', async () => {
    const onExecute = vi.fn()
    render(
      <PendingRecurring items={mockItems} onExecute={onExecute} onSkip={vi.fn()} />
    )
    const buttons = screen.getAllByText('등록')
    await userEvent.click(buttons[0])
    expect(onExecute).toHaveBeenCalledWith(1)
  })

  it('건너뛰기 버튼 클릭 시 onSkip이 호출된다', async () => {
    const onSkip = vi.fn()
    render(
      <PendingRecurring items={mockItems} onExecute={vi.fn()} onSkip={onSkip} />
    )
    const buttons = screen.getAllByText('건너뛰기')
    await userEvent.click(buttons[1])
    expect(onSkip).toHaveBeenCalledWith(2)
  })
})
