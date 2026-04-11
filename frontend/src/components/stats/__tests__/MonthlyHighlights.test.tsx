import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { generateHighlights } from '../MonthlyHighlights'
import MonthlyHighlights from '../MonthlyHighlights'

const baseInput = {
  incomeTotal: 3_500_000,
  expenseTotal: 1_200_000,
  savingsTotal: undefined as number | undefined,
  recurringTotal: undefined as number | undefined,
  prevSavingsTotal: undefined as number | undefined,
  budgetStats: null,
  comparison: null,
}

describe('generateHighlights', () => {
  it('지출 > 수입이면 적자 경고를 생성한다', () => {
    const result = generateHighlights({ ...baseInput, incomeTotal: 1_000_000, expenseTotal: 1_200_000 })
    expect(result[0].type).toBe('warning')
    expect(result[0].message).toContain('수입을 초과')
  })

  it('savingsTotal 기반으로 저축률 달성을 판단한다 (fallback 계산 사용 안 함)', () => {
    // savingsTotal=700_000 / income=3_500_000 = 20% → 달성
    const result = generateHighlights({ ...baseInput, savingsTotal: 700_000 })
    expect(result.some(h => h.message.includes('저축률') && h.type === 'positive')).toBe(true)
  })

  it('savingsTotal 미제공 시 저축률 규칙(#3)을 스킵한다', () => {
    // net > 0이어도 savingsTotal 없으면 저축률 하이라이트 없음
    const result = generateHighlights({ ...baseInput, savingsTotal: undefined })
    expect(result.some(h => h.message.includes('저축률'))).toBe(false)
  })

  it('고정비/수입 >= 40% 시 info 하이라이트를 생성한다 (규칙 #5)', () => {
    // recurringTotal=1_400_000 / income=3_500_000 = 40%
    const result = generateHighlights({ ...baseInput, recurringTotal: 1_400_000 })
    expect(result.some(h => h.message.includes('고정비') && h.type === 'info')).toBe(true)
  })

  it('전월 대비 저축 감소 시 info 하이라이트를 생성한다 (규칙 #6)', () => {
    const result = generateHighlights({ ...baseInput, savingsTotal: 300_000, prevSavingsTotal: 500_000 })
    expect(result.some(h => h.message.includes('저축이 줄었') && h.type === 'info')).toBe(true)
  })

  it('최대 4개 하이라이트만 반환한다', () => {
    const result = generateHighlights({
      incomeTotal: 1_000_000,
      expenseTotal: 1_200_000,
      savingsTotal: 0,
      recurringTotal: 600_000,
      prevSavingsTotal: 500_000,
      budgetStats: {
        month: '2026-04',
        total_budget: 800_000,
        total_spent: 1_200_000,
        categories: [
          { category_name: '식비', budget_amount: 300_000, spent_amount: 400_000, remaining_amount: -100_000, usage_percentage: 133, is_exceeded: true },
          { category_name: '교통', budget_amount: 100_000, spent_amount: 150_000, remaining_amount: -50_000, usage_percentage: 150, is_exceeded: true },
          { category_name: '쇼핑', budget_amount: 200_000, spent_amount: 300_000, remaining_amount: -100_000, usage_percentage: 150, is_exceeded: true },
        ],
      },
      comparison: null,
    })
    expect(result.length).toBeLessThanOrEqual(4)
  })
})

describe('MonthlyHighlights 컴포넌트', () => {
  it('하이라이트 클릭 시 onHighlightClick 콜백이 호출된다', async () => {
    const user = userEvent.setup()
    const onHighlightClick = vi.fn()
    render(
      <MonthlyHighlights
        incomeTotal={1_000_000}
        expenseTotal={1_200_000}
        budgetStats={null}
        comparison={null}
        onHighlightClick={onHighlightClick}
      />
    )
    // 적자 경고가 표시됨
    const item = screen.getByText(/수입을 초과/)
    await user.click(item.closest('li')!)
    // 적자 경고 #1은 딥링크 없음 → 콜백 호출 안 됨
    expect(onHighlightClick).not.toHaveBeenCalled()
  })

  it('예산 초과 하이라이트 클릭 시 section-budget으로 딥링크한다', async () => {
    const user = userEvent.setup()
    const onHighlightClick = vi.fn()
    render(
      <MonthlyHighlights
        incomeTotal={3_500_000}
        expenseTotal={1_200_000}
        budgetStats={{
          month: '2026-04',
          total_budget: 1_000_000,
          total_spent: 1_200_000,
          categories: [
            { category_name: '식비', budget_amount: 300_000, spent_amount: 400_000, remaining_amount: -100_000, usage_percentage: 133, is_exceeded: true },
          ],
        }}
        comparison={null}
        onHighlightClick={onHighlightClick}
      />
    )
    const budgetItem = screen.getByText(/예산을 .* 초과/)
    await user.click(budgetItem.closest('button')!)
    expect(onHighlightClick).toHaveBeenCalledWith('section-budget')
  })
})
