import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RecurringManageSection from '../RecurringManageSection'
import type { RecurringTransaction } from '../../../types'

const MONTH_STR = '2026-04'
const EMPTY_MAP = new Map<number, number>()

const makeItem = (overrides: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 1, user_id: 1, household_id: 1, type: 'expense',
  amount: 17000, description: '넷플릭스', category_id: null,
  frequency: 'monthly', interval: null, day_of_month: 15,
  day_of_week: null, month_of_year: null,
  start_date: '2026-01-15', end_date: null,
  next_due_date: '2026-05-15', is_active: true,
  created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  category_emoji: null,
  ...overrides,
})

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('RecurringManageSection', () => {
  it('빈 목록이면 안내 문구를 표시한다', () => {
    wrap(<RecurringManageSection items={[]} monthStr={MONTH_STR} executedAmountMap={EMPTY_MAP} />)
    expect(screen.getByText(/정기거래가 없습니다/)).toBeInTheDocument()
  })

  it('활성 건수와 이번 달 지출 합계를 표시한다', () => {
    const executedMap = new Map([[1, 17000], [2, 14900]])
    const items = [
      makeItem({ id: 1, amount: 17000, type: 'expense', next_due_date: '2026-05-15' }),
      makeItem({ id: 2, amount: 14900, type: 'expense', next_due_date: '2026-05-28' }),
    ]
    wrap(<RecurringManageSection items={items} monthStr={MONTH_STR} executedAmountMap={executedMap} />)
    expect(screen.getByText(/활성 2건/)).toBeInTheDocument()
    expect(screen.getByText(/31,900/)).toBeInTheDocument()
  })

  it('실행된 항목은 실제 금액과 완료를 표시한다', () => {
    const executedMap = new Map([[1, 19000]])
    wrap(
      <RecurringManageSection
        items={[makeItem({ id: 1, amount: 17000, next_due_date: '2026-05-15' })]}
        monthStr={MONTH_STR}
        executedAmountMap={executedMap}
      />
    )
    // 항목 금액 + 푸터 요약 모두 실제 금액 표시
    expect(screen.getAllByText(/19,000/).length).toBeGreaterThan(0)
    expect(screen.getByText(/✓ 완료/)).toBeInTheDocument()
  })

  it('금액이 변경된 경우 기본 금액에 취소선을 표시한다', () => {
    const executedMap = new Map([[1, 19000]])
    wrap(
      <RecurringManageSection
        items={[makeItem({ id: 1, amount: 17000, next_due_date: '2026-05-15' })]}
        monthStr={MONTH_STR}
        executedAmountMap={executedMap}
      />
    )
    const strikethrough = screen.getByText(/17,000/)
    expect(strikethrough).toHaveClass('line-through')
  })

  it('완료 상태지만 executedMap에 없으면 건너뜀을 표시한다', () => {
    wrap(
      <RecurringManageSection
        items={[makeItem({ next_due_date: '2026-05-15' })]}
        monthStr={MONTH_STR}
        executedAmountMap={EMPTY_MAP}
      />
    )
    expect(screen.getByText('건너뜀')).toBeInTheDocument()
  })

  it('next_due_date가 이번 달이면 예정 날짜를 표시한다', () => {
    wrap(
      <RecurringManageSection
        items={[makeItem({ next_due_date: '2026-04-28' })]}
        monthStr={MONTH_STR}
        executedAmountMap={EMPTY_MAP}
      />
    )
    expect(screen.getByText(/4\/28 예정/)).toBeInTheDocument()
  })

  it('관리 링크가 /recurring으로 연결된다', () => {
    wrap(<RecurringManageSection items={[makeItem({})]} monthStr={MONTH_STR} executedAmountMap={EMPTY_MAP} />)
    expect(screen.getByText('관리 →').closest('a')).toHaveAttribute('href', '/recurring')
  })

  it('접기 버튼 클릭 시 목록이 사라진다', async () => {
    wrap(<RecurringManageSection items={[makeItem({ description: '넷플릭스' })]} monthStr={MONTH_STR} executedAmountMap={EMPTY_MAP} />)
    expect(screen.getByText('넷플릭스')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('접기'))
    expect(screen.queryByText('넷플릭스')).toBeNull()
  })
})
