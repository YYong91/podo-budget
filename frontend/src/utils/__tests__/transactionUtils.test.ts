/**
 * @file transactionUtils.test.ts
 * @description transactionUtils 순수 함수 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import {
  calcTotals,
  calcDaySummaries,
  type UnifiedTransaction,
} from '../transactionUtils'

/* ─── 테스트 데이터 ─── */
const tx = (overrides: Partial<UnifiedTransaction> & { id: number; date: string; type: 'expense' | 'income' }): UnifiedTransaction => ({
  description: '테스트',
  amount: 1000,
  category_id: null,
  ...overrides,
})

const sampleTxs: UnifiedTransaction[] = [
  tx({ id: 1, date: '2026-03-01', type: 'expense', amount: 5000 }),
  tx({ id: 2, date: '2026-03-01', type: 'income', amount: 3000 }),
  tx({ id: 3, date: '2026-03-02', type: 'expense', amount: 8000 }),
  tx({ id: 4, date: '2026-03-02', type: 'expense', amount: 2000 }),
  tx({ id: 5, date: '2026-03-03', type: 'income', amount: 50000 }),
]

describe('calcTotals', () => {
  it('지출·수입 합계를 정확히 계산한다', () => {
    const expenses = [{ amount: 5000 }, { amount: 8000 }, { amount: 2000 }]
    const incomes = [{ amount: 3000 }, { amount: 50000 }]

    const { totalExpense, totalIncome } = calcTotals(expenses, incomes)
    expect(totalExpense).toBe(15000)
    expect(totalIncome).toBe(53000)
  })

  it('빈 배열이면 0을 반환한다', () => {
    const { totalExpense, totalIncome } = calcTotals([], [])
    expect(totalExpense).toBe(0)
    expect(totalIncome).toBe(0)
  })
})

describe('calcDaySummaries', () => {
  it('날짜별 지출·수입 합계를 계산한다', () => {
    const summaries = calcDaySummaries(sampleTxs)

    expect(summaries.get('2026-03-01')).toEqual({ expense: 5000, income: 3000 })
    expect(summaries.get('2026-03-02')).toEqual({ expense: 10000, income: 0 })
    expect(summaries.get('2026-03-03')).toEqual({ expense: 0, income: 50000 })
  })

  it('빈 배열이면 빈 Map을 반환한다', () => {
    expect(calcDaySummaries([]).size).toBe(0)
  })
})
