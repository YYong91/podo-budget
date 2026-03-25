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
}

type FilterType = 'all' | 'expense' | 'income'

/**
 * 거래 목록을 날짜별로 그룹핑한다 (날짜 역순, 같은 날짜 내 id 역순).
 * @param transactions 정렬 전 거래 배열
 * @returns 날짜 키(YYYY-MM-DD) → 거래 배열 Map (삽입 순서 = 날짜 역순)
 */
export function groupTransactionsByDate(
  transactions: UnifiedTransaction[],
): Map<string, UnifiedTransaction[]> {
  // 정렬: 날짜 역순 → 같은 날짜 내 id 역순
  const sorted = [...transactions].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    if (dateCmp !== 0) return dateCmp
    return b.id - a.id
  })

  const grouped = new Map<string, UnifiedTransaction[]>()
  for (const tx of sorted) {
    const dateKey = tx.date.slice(0, 10)
    const group = grouped.get(dateKey)
    if (group) group.push(tx)
    else grouped.set(dateKey, [tx])
  }
  return grouped
}

/**
 * 타입 필터를 적용한다.
 */
export function filterByType(
  transactions: UnifiedTransaction[],
  filter: FilterType,
): UnifiedTransaction[] {
  if (filter === 'all') return transactions
  return transactions.filter(t => t.type === filter)
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
