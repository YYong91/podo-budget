import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduledTransactions from '../ScheduledTransactions'
import type { RecurringTransaction } from '../../types'

const makeItem = (overrides: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 1, user_id: 1, household_id: 1, type: 'expense',
  amount: 17000, description: '넷플릭스', category_id: null,
  frequency: 'monthly', interval: null, day_of_month: 15,
  day_of_week: null, month_of_year: null,
  start_date: '2026-01-15', end_date: null,
  next_due_date: '2026-04-15', is_active: true,
  created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
})

describe('ScheduledTransactions', () => {
  it('빈 배열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <ScheduledTransactions items={[]} currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('지출만 있으면 "지출 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions items={[makeItem({ type: 'expense', next_due_date: '2026-04-15' })]} currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(screen.getByText('지출 예정')).toBeInTheDocument()
  })

  it('수입만 있으면 "수입 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions items={[makeItem({ type: 'income', next_due_date: '2026-04-25' })]} currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(screen.getByText('수입 예정')).toBeInTheDocument()
  })

  it('지출+수입 있으면 "지출/수입 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[
          makeItem({ id: 1, type: 'expense', next_due_date: '2026-04-15' }),
          makeItem({ id: 2, type: 'income', next_due_date: '2026-04-25' }),
        ]}
        currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('지출/수입 예정')).toBeInTheDocument()
  })

  it('접힌 상태에서 건수와 총액을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[
          makeItem({ id: 1, amount: 17000, next_due_date: '2026-04-15' }),
          makeItem({ id: 2, amount: 14900, next_due_date: '2026-04-28' }),
        ]}
        currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('2건')).toBeInTheDocument()
    expect(screen.getByText('₩31,900')).toBeInTheDocument()
  })

  it('현재 달이 아닌 정기거래는 필터링한다', () => {
    const { container } = render(
      <ScheduledTransactions items={[makeItem({ next_due_date: '2026-05-15' })]} currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('펼치면 날짜순으로 항목이 표시된다', async () => {
    render(
      <ScheduledTransactions
        items={[
          makeItem({ id: 1, description: '넷플릭스', next_due_date: '2026-04-15' }),
          makeItem({ id: 2, description: '유튜브', next_due_date: '2026-04-28' }),
        ]}
        currentYear={2026} currentMonth={3} onExecute={vi.fn()} onSkip={vi.fn()}
      />
    )
    await userEvent.click(screen.getByText('지출 예정'))
    expect(screen.getByText('넷플릭스')).toBeInTheDocument()
    expect(screen.getByText('유튜브')).toBeInTheDocument()
  })

  it('도래한 항목에 등록/건너뛰기 버튼이 표시된다', () => {
    // Use January 2026 with a past due date
    render(
      <ScheduledTransactions items={[makeItem({ next_due_date: '2026-01-01' })]} currentYear={2026} currentMonth={0} onExecute={vi.fn()} onSkip={vi.fn()} />
    )
    // Auto-expanded because there's a pending item
    expect(screen.getByText('등록')).toBeInTheDocument()
    expect(screen.getByText('건너뛰기')).toBeInTheDocument()
  })

  it('등록 버튼 클릭 시 onExecute가 호출된다', async () => {
    const onExecute = vi.fn()
    render(
      <ScheduledTransactions items={[makeItem({ id: 5, next_due_date: '2026-01-01' })]} currentYear={2026} currentMonth={0} onExecute={onExecute} onSkip={vi.fn()} />
    )
    await userEvent.click(screen.getByText('등록'))
    expect(onExecute).toHaveBeenCalledWith(5)
  })

  it('건너뛰기 버튼 클릭 시 onSkip이 호출된다', async () => {
    const onSkip = vi.fn()
    render(
      <ScheduledTransactions items={[makeItem({ id: 5, next_due_date: '2026-01-01' })]} currentYear={2026} currentMonth={0} onExecute={vi.fn()} onSkip={onSkip} />
    )
    await userEvent.click(screen.getByText('건너뛰기'))
    expect(onSkip).toHaveBeenCalledWith(5)
  })
})
