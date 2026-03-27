/**
 * @file useMonthlyTransactions.ts
 * @description 월별 거래 데이터 fetch + 필터링 + 그룹핑 훅
 * TransactionList에서 월 뷰 관련 데이터 로직을 추출하여 단일 책임 원칙을 따른다.
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { getMonthRange } from '../utils/calendar'
import type { Expense, Income, Category, RecurringTransaction } from '../types'
import type { UnifiedTransaction } from './useTransactionSearch'

type FilterType = 'all' | 'expense' | 'income'

export const FILTER_STORAGE_KEY = 'podo-transaction-filter'

interface UseMonthlyTransactionsOptions {
  activeHouseholdId: number | null
}

export function useMonthlyTransactions({ activeHouseholdId }: UseMonthlyTransactionsOptions) {
  const [searchParams, setSearchParams] = useSearchParams()

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

  // 데이터 상태
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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

  // 카테고리 로드
  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  // 데이터 로드
  const fetchData = useCallback(async () => {
    if (!activeHouseholdId) return
    setLoading(true)
    setError(false)
    try {
      const { start, end } = getMonthRange(currentYear, currentMonth)
      const baseParams = {
        start_date: start,
        end_date: end,
        limit: 1000,
        household_id: activeHouseholdId,
      }

      const [expRes, incRes, pendingRes] = await Promise.all([
        expenseApi.getAll(baseParams).catch(() => ({ data: [] as Expense[] })),
        incomeApi.getAll(baseParams).catch(() => ({ data: [] as Income[] })),
        recurringApi.getPending(activeHouseholdId).catch(() => ({ data: [] as RecurringTransaction[] })),
      ])

      setExpenses(expRes.data)
      setIncomes(incRes.data)
      setPendingRecurring(pendingRes?.data ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth, activeHouseholdId])

  useEffect(() => { fetchData() }, [fetchData])

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

    // 날짜 역순 + 같은 날짜 내 id 역순
    filtered.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date)
      if (dateCmp !== 0) return dateCmp
      return b.id - a.id
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
    pendingRecurring,
    setPendingRecurring,

    // 상태 업데이터 (카테고리 변경 등에서 사용)
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
