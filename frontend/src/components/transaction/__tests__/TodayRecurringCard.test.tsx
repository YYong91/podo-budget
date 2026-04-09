import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TodayRecurringCard from '../TodayRecurringCard'
import type { RecurringTransaction } from '../../../types'

const makeItem = (overrides: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 1, user_id: 1, household_id: 1, type: 'expense',
  amount: 17000, description: '넷플릭스', category_id: null,
  frequency: 'monthly', interval: null, day_of_month: 15,
  day_of_week: null, month_of_year: null,
  start_date: '2026-01-15', end_date: null,
  next_due_date: '2026-01-01', is_active: true,
  created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  ...overrides,
})

describe('TodayRecurringCard', () => {
  beforeEach(() => sessionStorage.clear())
  it('빈 배열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <TodayRecurringCard items={[]} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('오늘 이전 due_date인 항목만 표시한다', () => {
    const items = [
      makeItem({ id: 1, next_due_date: '2026-01-01' }),
      makeItem({ id: 2, next_due_date: '2099-12-31' }),
    ]
    render(<TodayRecurringCard items={items} onExecute={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/1건/)).toBeInTheDocument()
  })

  it('건수와 순번을 표시한다', () => {
    const items = [
      makeItem({ id: 1, description: '넷플릭스', next_due_date: '2026-01-01' }),
      makeItem({ id: 2, description: '유튜브', next_due_date: '2026-01-01' }),
    ]
    render(<TodayRecurringCard items={items} onExecute={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/2건/)).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('지출/수입 아이콘을 구분한다', () => {
    render(
      <TodayRecurringCard
        items={[makeItem({ type: 'income', description: '급여', next_due_date: '2026-01-01' })]}
        onExecute={vi.fn()} onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('급여')).toBeInTheDocument()
  })

  it('등록 버튼 클릭 시 onExecute가 호출된다', async () => {
    const onExecute = vi.fn().mockResolvedValue(undefined)
    render(
      <TodayRecurringCard items={[makeItem({ id: 5, next_due_date: '2026-01-01' })]} onExecute={onExecute} onSkip={vi.fn()} />
    )
    await userEvent.click(screen.getByText('등록하기'))
    expect(onExecute).toHaveBeenCalledWith(5)
  })

  it('건너뛰기 버튼 클릭 시 onSkip이 호출된다', async () => {
    const onSkip = vi.fn().mockResolvedValue(undefined)
    render(
      <TodayRecurringCard items={[makeItem({ id: 5, next_due_date: '2026-01-01' })]} onExecute={vi.fn()} onSkip={onSkip} />
    )
    await userEvent.click(screen.getByText('건너뛰기'))
    expect(onSkip).toHaveBeenCalledWith(5)
  })

  it('API 호출 중에는 버튼이 비활성화된다', async () => {
    let resolve: () => void
    const onExecute = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(
      <TodayRecurringCard items={[makeItem({ id: 1, next_due_date: '2026-01-01' })]} onExecute={onExecute} onSkip={vi.fn()} />
    )
    await userEvent.click(screen.getByText('등록하기'))
    expect(screen.getByText('등록하기').closest('button')).toBeDisabled()
    resolve!()
  })

  it('API 실패 시 버튼이 복원된다', async () => {
    const onExecute = vi.fn().mockRejectedValue(new Error('fail'))
    render(
      <TodayRecurringCard items={[makeItem({ id: 1, next_due_date: '2026-01-01' })]} onExecute={onExecute} onSkip={vi.fn()} />
    )
    await userEvent.click(screen.getByText('등록하기'))
    await waitFor(() => {
      expect(screen.getByText('등록하기').closest('button')).not.toBeDisabled()
    })
  })

  it('나중에 버튼 클릭 시 카드가 사라진다', async () => {
    render(
      <TodayRecurringCard items={[makeItem({ id: 1, next_due_date: '2026-01-01' })]} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    await userEvent.click(screen.getByText('나중에'))
    expect(screen.queryByText('넷플릭스')).toBeNull()
  })

  it('나중에 클릭해도 onExecute/onSkip이 호출되지 않는다', async () => {
    const onExecute = vi.fn()
    const onSkip = vi.fn()
    render(
      <TodayRecurringCard items={[makeItem({ id: 1, next_due_date: '2026-01-01' })]} onExecute={onExecute} onSkip={onSkip} />
    )
    await userEvent.click(screen.getByText('나중에'))
    expect(onExecute).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })
})
