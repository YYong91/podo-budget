/**
 * @file useMonthlyTransactions.ts
 * @description 월별 거래 데이터 fetch + 필터링 + 그룹핑 훅
 * TransactionList에서 월 뷰 관련 데이터 로직을 추출하여 단일 책임 원칙을 따른다.
 *
 * [React Query 전환]
 * - 데이터 fetch: useState+useEffect → useQuery (캐시 기반)
 * - 카테고리 인라인 수정: setState → queryClient.setQueryData (캐시 직접 업데이트)
 * - PullToRefresh: fetchData → query.refetch 위임
 * - setExpenses/setIncomes 인터페이스는 유지 (TransactionList 변경 없음)
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { getMonthRange } from '../utils/calendar'
import type { Expense, Income, RecurringTransaction } from '../types'
import type { UnifiedTransaction } from './useTransactionSearch'

type FilterType = 'all' | 'expense' | 'income'

export const FILTER_STORAGE_KEY = 'podo-transaction-filter'

// 쿼리 키 팩토리 — 캐시 무효화 시 참조 일관성 보장
export const monthlyTransactionsKeys = {
  all: ['monthly-transactions'] as const,
  byMonth: (householdId: number, year: number, month: number) =>
    ['monthly-transactions', householdId, year, month] as const,
  categories: ['categories'] as const,
}

const CATEGORY_STALE_TIME = 5 * 60 * 1000 // 카테고리는 5분 캐시 (변경 빈도 낮음)

type MonthlyData = { expenses: Expense[]; incomes: Income[]; recurring: RecurringTransaction[] }

// 훅 외부 fetch 함수 — React Query queryFn으로 사용
async function fetchMonthlyData(
  householdId: number,
  start: string,
  end: string,
): Promise<{ expenses: Expense[]; incomes: Income[]; recurring: RecurringTransaction[] }> {
  const baseParams = { start_date: start, end_date: end, limit: 1000, household_id: householdId }

  const [expRes, incRes, recurringRes] = await Promise.all([
    expenseApi.getAll(baseParams).catch(() => ({ data: [] as Expense[] })),
    incomeApi.getAll(baseParams).catch(() => ({ data: [] as Income[] })),
    recurringApi.getAll({ household_id: householdId }).catch(() => ({ data: [] as RecurringTransaction[] })),
  ])

  // 핵심 데이터(지출+수입) 모두 빈 응답이고 정기거래도 없으면 — 전부 실패한 것으로 간주
  const expenses = expRes.data
  const incomes = incRes.data
  const recurring = recurringRes.data ?? []

  return { expenses, incomes, recurring }
}

interface UseMonthlyTransactionsOptions {
  activeHouseholdId: number | null
}

export function useMonthlyTransactions({ activeHouseholdId }: UseMonthlyTransactionsOptions) {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // URL에서 월 파라미터 읽기 (YYYY-MM 형식)
  const monthParam = searchParams.get('month')
  const [currentYear, currentMonth] = useMemo(() => {
    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      if (y && m) return [y, m - 1] // 0-indexed
    }
    const now = new Date()
    return [now.getFullYear(), now.getMonth()]
  }, [monthParam])

  // 필터: URL → sessionStorage → 'all' 순서로 복원
  const urlFilter = searchParams.get('filter') as FilterType | null
  const filter: FilterType = urlFilter || (sessionStorage.getItem(FILTER_STORAGE_KEY) as FilterType) || 'all'
  const categoryFilter = searchParams.get('category')

  // 필터 변경 시 sessionStorage에 백업 (상세→목록 복귀 시 복원용)
  useEffect(() => {
    if (filter !== 'all') {
      sessionStorage.setItem(FILTER_STORAGE_KEY, filter)
    } else {
      sessionStorage.removeItem(FILTER_STORAGE_KEY)
    }
  }, [filter])

  // URL 파라미터 업데이트
  const setParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  // 월 이동
  const navigateMonth = useCallback((delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    setParams({ month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}` })
  }, [currentYear, currentMonth, setParams])

  // 필터 토글 — 해제 시 sessionStorage도 클리어 (복원 방지)
  const toggleFilter = useCallback((type: 'expense' | 'income') => {
    const newFilter = filter === type ? null : type
    if (!newFilter) sessionStorage.removeItem(FILTER_STORAGE_KEY)
    setParams({ filter: newFilter })
  }, [filter, setParams])

  // 월별 데이터 쿼리 (지출 + 수입 + 정기거래)
  const { start, end } = getMonthRange(currentYear, currentMonth)

  const {
    data: transactionData,
    isLoading: isTransactionLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: monthlyTransactionsKeys.byMonth(activeHouseholdId ?? 0, currentYear, currentMonth),
    queryFn: () => fetchMonthlyData(activeHouseholdId!, start, end),
    enabled: !!activeHouseholdId,
  })

  // 카테고리 쿼리 (5분 캐시 — 변경 빈도 낮음)
  const { data: categories = [] } = useQuery({
    queryKey: monthlyTransactionsKeys.categories,
    queryFn: () => categoryApi.getAll().then(res => res.data),
    staleTime: CATEGORY_STALE_TIME,
  })

  // activeHouseholdId가 없으면 로딩 중으로 간주 (기존 동작 유지)
  const loading = !activeHouseholdId || isTransactionLoading
  const error = isError

  const expenses: Expense[] = transactionData?.expenses ?? []
  const incomes: Income[] = transactionData?.incomes ?? []

  // 정기거래: is_active 필터링 + pending 분류
  const todayStr = new Date().toISOString().slice(0, 10)
  const allRecurring = useMemo(
    () => (transactionData?.recurring ?? []).filter(r => r.is_active),
    [transactionData?.recurring],
  )
  const pendingRecurring = useMemo(
    () => allRecurring.filter(r => r.next_due_date <= todayStr),
    // todayStr은 날짜가 바뀌어야 변하므로 useMemo 의존성에서 제외 (렌더링 기준)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRecurring],
  )

  // PullToRefresh / 에러 재시도 시 호출하는 공개 인터페이스
  const fetchData = useCallback(async () => {
    await refetch()
  }, [refetch])

  // 카테고리 인라인 변경 — 캐시를 직접 업데이트해 리패치 없이 즉시 반영
  // TransactionList의 setExpenses/setIncomes 호출 인터페이스를 그대로 유지한다
  const setExpenses = useCallback(
    (updater: Expense[] | ((prev: Expense[]) => Expense[])) => {
      const key = monthlyTransactionsKeys.byMonth(activeHouseholdId ?? 0, currentYear, currentMonth)
      queryClient.setQueryData(key, (prev: MonthlyData | undefined) => {
        if (!prev) return prev
        const current = prev.expenses
        const next = typeof updater === 'function' ? updater(current) : updater
        return { ...prev, expenses: next }
      })
    },
    [queryClient, activeHouseholdId, currentYear, currentMonth],
  )

  const setIncomes = useCallback(
    (updater: Income[] | ((prev: Income[]) => Income[])) => {
      const key = monthlyTransactionsKeys.byMonth(activeHouseholdId ?? 0, currentYear, currentMonth)
      queryClient.setQueryData(key, (prev: MonthlyData | undefined) => {
        if (!prev) return prev
        const current = prev.incomes
        const next = typeof updater === 'function' ? updater(current) : updater
        return { ...prev, incomes: next }
      })
    },
    [queryClient, activeHouseholdId, currentYear, currentMonth],
  )

  // setPendingRecurring — ScheduledTransactions execute/skip 후 UI 즉시 반영용
  // React Query 전환 후에도 인터페이스 유지 (호출 측 변경 없음)
  const setPendingRecurring = useCallback(
    (updater: RecurringTransaction[] | ((prev: RecurringTransaction[]) => RecurringTransaction[])) => {
      const key = monthlyTransactionsKeys.byMonth(activeHouseholdId ?? 0, currentYear, currentMonth)
      queryClient.setQueryData(key, (prev: MonthlyData | undefined) => {
        if (!prev) return prev
        const next = typeof updater === 'function' ? updater(prev.recurring) : updater
        return { ...prev, recurring: next }
      })
    },
    [queryClient, activeHouseholdId, currentYear, currentMonth],
  )

  // 카테고리 O(1) 조회용 Map
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // 통합 + 정렬 + 그룹핑
  const { grouped, totalExpense, totalIncome, daySummaries } = useMemo(() => {
    const all: UnifiedTransaction[] = [
      ...expenses.map(e => ({ ...e, type: 'expense' as const })),
      ...incomes.map(i => ({ ...i, type: 'income' as const })),
    ]

    // 필터 적용 (타입 + 카테고리)
    let filtered = filter === 'all' ? all : all.filter(t => t.type === filter)
    if (categoryFilter) {
      filtered = filtered.filter(t => {
        const cat = t.category_id != null ? categoryMap.get(t.category_id) : null
        return cat?.name === categoryFilter
      })
    }

    // 날짜 역순 + 같은 날짜 내 created_at 역순 (입력 순서 보존)
    // id 비교는 지출/수입이 별개 테이블이라 시퀀스가 달라 의미 없음
    filtered.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date)
      if (dateCmp !== 0) return dateCmp
      return b.created_at.localeCompare(a.created_at)
    })

    // 날짜별 그룹핑
    const grouped = new Map<string, UnifiedTransaction[]>()
    for (const tx of filtered) {
      const dateKey = tx.date.slice(0, 10)
      const group = grouped.get(dateKey)
      if (group) group.push(tx)
      else grouped.set(dateKey, [tx])
    }

    // 요약 (항상 전체 데이터 기준)
    let totalExpense = 0
    let totalIncome = 0
    for (const e of expenses) totalExpense += e.amount
    for (const i of incomes) totalIncome += i.amount

    // 캘린더 날짜별 요약 (타입+카테고리 필터 반영)
    const daySummaries = new Map<string, { expense: number; income: number }>()
    const calendarSource = filtered
    for (const tx of calendarSource) {
      const key = tx.date.slice(0, 10)
      const s = daySummaries.get(key) ?? { expense: 0, income: 0 }
      if (tx.type === 'expense') s.expense += tx.amount
      else s.income += tx.amount
      daySummaries.set(key, s)
    }

    return { grouped, totalExpense, totalIncome, daySummaries }
  }, [expenses, incomes, filter, categoryFilter, categoryMap])

  const monthLabel = `${currentYear}년 ${currentMonth + 1}월`

  return {
    // 날짜 네비게이션
    currentYear,
    currentMonth,
    monthLabel,
    navigateMonth,

    // 필터
    filter,
    toggleFilter,

    // 데이터
    expenses,
    incomes,
    categories,
    categoryMap,
    allRecurring,
    pendingRecurring,
    setPendingRecurring,

    // 상태 업데이터 (카테고리 변경 등에서 사용 — 캐시 직접 업데이트)
    setExpenses,
    setIncomes,

    // 그룹핑된 데이터
    grouped,
    totalExpense,
    totalIncome,
    daySummaries,

    // 로딩/에러
    loading,
    error,
    fetchData,
  }
}
