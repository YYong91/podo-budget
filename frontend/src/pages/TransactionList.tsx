/**
 * @file TransactionList.tsx
 * @description 통합 거래 목록 페이지 — 월별 캘린더 + 날짜별 그룹핑
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import MiniCalendar from '../components/MiniCalendar'
import TransactionItem from '../components/TransactionItem'
import PendingRecurring from '../components/PendingRecurring'
import CategoryBottomSheet from '../components/CategoryBottomSheet'
import PullToRefresh from '../components/PullToRefresh'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Expense, Income, Category, RecurringTransaction } from '../types'
import { formatAmount } from '../utils/format'
import { getMonthRange, formatDateHeader } from '../utils/calendar'

type FilterType = 'all' | 'expense' | 'income'

interface UnifiedTransaction {
  id: number
  type: 'expense' | 'income'
  date: string
  description: string
  amount: number
  category_id: number | null
  exclude_from_stats?: boolean
  raw_input?: string | null
}

export default function TransactionList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const { addToast } = useToast()

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

  const filter: FilterType = (searchParams.get('filter') as FilterType) || 'all'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 카테고리 바텀시트 상태
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<UnifiedTransaction | null>(null)
  const [sheetSaving, setSheetSaving] = useState(false)

  // 날짜 섹션 ref 맵
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const todayString = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

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

  // 필터 토글
  const toggleFilter = useCallback((type: 'expense' | 'income') => {
    setParams({ filter: filter === type ? null : type })
  }, [filter, setParams])

  // 카테고리 로드
  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  // 데이터 로드
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { start, end } = getMonthRange(currentYear, currentMonth)
      const baseParams = {
        start_date: start,
        end_date: end,
        limit: 1000,
        household_id: activeHouseholdId!,
      }

      const [expRes, incRes, pendingRes] = await Promise.all([
        expenseApi.getAll(baseParams).catch(() => ({ data: [] as Expense[] })),
        incomeApi.getAll(baseParams).catch(() => ({ data: [] as Income[] })),
        recurringApi.getPending(activeHouseholdId!).catch(() => ({ data: [] as RecurringTransaction[] })),
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

  // 통합 + 정렬 + 그룹핑
  const { grouped, totalExpense, totalIncome, daySummaries } = useMemo(() => {
    const all: UnifiedTransaction[] = [
      ...expenses.map(e => ({ ...e, type: 'expense' as const })),
      ...incomes.map(i => ({ ...i, type: 'income' as const })),
    ]

    // 필터 적용
    const filtered = filter === 'all' ? all : all.filter(t => t.type === filter)

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

    // 캘린더 날짜별 요약 (필터 반영)
    const daySummaries = new Map<string, { expense: number; income: number }>()
    const calendarSource = filter === 'all' ? all : all.filter(t => t.type === filter)
    for (const tx of calendarSource) {
      const key = tx.date.slice(0, 10)
      const s = daySummaries.get(key) ?? { expense: 0, income: 0 }
      if (tx.type === 'expense') s.expense += tx.amount
      else s.income += tx.amount
      daySummaries.set(key, s)
    }

    return { grouped, totalExpense, totalIncome, daySummaries }
  }, [expenses, incomes, filter])

  // 캘린더 날짜 클릭 → 스크롤
  const handleDateClick = useCallback((dateString: string) => {
    const ref = dateRefs.current.get(dateString)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // 카테고리 변경
  const handleCategorySelect = useCallback(async (categoryId: number | null) => {
    if (!sheetTarget) return
    setSheetSaving(true)
    try {
      if (sheetTarget.type === 'expense') {
        await expenseApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        setExpenses(prev => prev.map(e =>
          e.id === sheetTarget.id ? { ...e, category_id: categoryId } : e
        ))
      } else {
        await incomeApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        setIncomes(prev => prev.map(i =>
          i.id === sheetTarget.id ? { ...i, category_id: categoryId } : i
        ))
      }
      setSheetOpen(false)
    } catch {
      toast.error('카테고리 변경에 실패했습니다')
    } finally {
      setSheetSaving(false)
    }
  }, [sheetTarget])

  const monthLabel = `${currentYear}년 ${currentMonth + 1}월`

  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState onRetry={fetchData} />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{monthLabel}</h1>
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* 요약 + 필터 */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => toggleFilter('expense')}
          className={`text-center transition-opacity ${
            filter === 'income' ? 'opacity-40' : ''
          }`}
        >
          <div className="text-xs text-[var(--text-tertiary)]">지출</div>
          <div className={`text-base font-bold ${filter !== 'income' ? 'text-grape-700 dark:text-grape-400' : 'text-[var(--text-muted)]'}`}>
            {formatAmount(totalExpense)}
          </div>
        </button>
        <div className="w-px h-8 bg-[var(--border-default)]" />
        <button
          onClick={() => toggleFilter('income')}
          className={`text-center transition-opacity ${
            filter === 'expense' ? 'opacity-40' : ''
          }`}
        >
          <div className="text-xs text-[var(--text-tertiary)]">수입</div>
          <div className={`text-base font-bold ${filter !== 'expense' ? 'text-leaf-600 dark:text-leaf-400' : 'text-[var(--text-muted)]'}`}>
            {formatAmount(totalIncome)}
          </div>
        </button>
      </div>

      {/* 반복 거래 알림 */}
      <PendingRecurring
        items={pendingRecurring}
        onExecute={async (id) => {
          try {
            const res = await recurringApi.execute(id)
            addToast('success', res.data.message)
            setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
            fetchData()
          } catch {
            addToast('error', '반복 거래 등록에 실패했습니다')
          }
        }}
        onSkip={async (id) => {
          try {
            const res = await recurringApi.skip(id)
            addToast('success', `다음 예정일: ${res.data.next_due_date}`)
            setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
          } catch {
            addToast('error', '건너뛰기에 실패했습니다')
          }
        }}
      />

      {/* 미니 캘린더 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-3">
        <MiniCalendar
          year={currentYear}
          month={currentMonth}
          daySummaries={daySummaries}
          onDateClick={handleDateClick}
          today={todayString}
        />
      </div>

      {/* 거래 리스트 */}
      {loading ? (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
          {/* 스켈레톤 UI */}
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)]">
                <div className="h-3 w-24 bg-warm-200 rounded animate-pulse" />
              </div>
              {[1, 2].map(j => (
                <div key={j} className="px-4 py-3 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-32 bg-warm-100 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-warm-100 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-12 bg-warm-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
          <EmptyState
            title={filter === 'all' ? '거래 내역이 없습니다' : `${filter === 'expense' ? '지출' : '수입'} 내역이 없습니다`}
            description="이번 달의 거래를 추가해보세요."
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
          {Array.from(grouped.entries()).map(([dateKey, txs]) => (
            <div key={dateKey}>
              {/* 스티키 날짜 헤더 */}
              <div
                ref={(el) => { if (el) dateRefs.current.set(dateKey, el) }}
                className="sticky top-0 md:top-0 z-10 bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)] scroll-mt-14 md:scroll-mt-0"
              >
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {formatDateHeader(dateKey)}
                </span>
              </div>
              {/* 거래 항목들 */}
              <div className="divide-y divide-[var(--border-subtle)]">
                {txs.map(tx => (
                  <TransactionItem
                    key={`${tx.type}-${tx.id}`}
                    id={tx.id}
                    type={tx.type}
                    description={tx.description}
                    amount={tx.amount}
                    categoryId={tx.category_id}
                    categories={categories}
                    excludeFromStats={tx.exclude_from_stats}
                    rawInput={tx.raw_input}
                    onCategoryClick={() => {
                      setSheetTarget(tx)
                      setSheetOpen(true)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 카테고리 바텀시트 */}
      <CategoryBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={handleCategorySelect}
        categories={categories}
        currentCategoryId={sheetTarget?.category_id ?? null}
        transactionType={sheetTarget?.type ?? 'expense'}
        saving={sheetSaving}
      />
    </div>
    </PullToRefresh>
  )
}
