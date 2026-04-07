/**
 * @file transactionUtils.ts
 * @description 거래 목록 관련 순수 유틸 함수
 * TransactionList.tsx에서 추출한 그룹핑·필터·요약 로직.
 */

export interface UnifiedTransaction {
  id: number
  type: 'expense' | 'income'
  date: string
  description: string
  amount: number
  category_id: number | null
  exclude_from_stats?: boolean
  raw_input?: string | null
  recurring_transaction_id?: number | null
}

/**
 * 거래 목록에서 총 지출·총 수입을 계산한다.
 */
export function calcTotals(
  expenses: { amount: number }[],
  incomes: { amount: number }[],
): { totalExpense: number; totalIncome: number } {
  let totalExpense = 0
  let totalIncome = 0
  for (const e of expenses) totalExpense += e.amount
  for (const i of incomes) totalIncome += i.amount
  return { totalExpense, totalIncome }
}

/**
 * 캘린더 날짜별 요약 (지출·수입 합계) 을 계산한다.
 */
export function calcDaySummaries(
  transactions: UnifiedTransaction[],
): Map<string, { expense: number; income: number }> {
  const summaries = new Map<string, { expense: number; income: number }>()
  for (const tx of transactions) {
    const key = tx.date.slice(0, 10)
    const s = summaries.get(key) ?? { expense: 0, income: 0 }
    if (tx.type === 'expense') s.expense += tx.amount
    else s.income += tx.amount
    summaries.set(key, s)
  }
  return summaries
}
