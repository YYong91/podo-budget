/**
 * @file TransactionList.tsx
 * @description 통합 거래 목록 페이지 — 월별 캘린더 + 날짜별 그룹핑
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import PeriodNavigator from '../components/stats/PeriodNavigator'
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
import { Search, X } from 'lucide-react'

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

  // 검색 모드
  const searchQuery = searchParams.get('search') ?? ''
  const isSearchMode = searchParams.has('search')
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // 검색 모드 진입
  const enterSearchMode = useCallback(() => {
    setParams({ search: '', month: null, filter: null })
  }, [setParams])

  // 검색 모드 해제 → 월 뷰 복귀
  const exitSearchMode = useCallback(() => {
    setParams({ search: null })
  }, [setParams])

  // 검색 실행
  const submitSearch = useCallback((value: string) => {
    if (value.trim()) {
      setParams({ search: value.trim() })
    }
  }, [setParams])

  // 검색 모드 진입 시 인풋 포커스
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchMode])

  // 카테고리 로드
  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  // 데이터 로드
  const fetchData = useCallback(async () => {
    // 가구 로딩 전 API 호출 방지 (#149)
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

  // 카테고리 O(1) 조회용 Map — TransactionItem에 배열 대신 전달 (#180)
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

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

  // TransactionItem.onCategoryClick 안정화 — 데이터 변경 시에만 재생성 (#240)
  const categoryClickHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>()
    for (const txs of grouped.values()) {
      for (const tx of txs) {
        handlers.set(`${tx.type}-${tx.id}`, () => {
          setSheetTarget(tx)
          setSheetOpen(true)
        })
      }
    }
    return handlers
  }, [grouped])

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
      addToast('error', '카테고리 변경에 실패했습니다')
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
      {/* 월 네비게이션 / 검색 바 */}
      {isSearchMode ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              key={searchQuery}
              ref={searchInputRef}
              type="search"
              defaultValue={searchQuery}
              placeholder="거래 내역 검색"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch(e.currentTarget.value)
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
            />
          </div>
          <button
            onClick={exitSearchMode}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="검색 닫기"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <PeriodNavigator label={monthLabel} onPrev={() => navigateMonth(-1)} onNext={() => navigateMonth(1)} />
          </div>
          <button
            onClick={enterSearchMode}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="검색"
          >
            <Search className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      )}

      {/* 요약 + 필터 (월 뷰 전용) */}
      {!isSearchMode && (
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => toggleFilter('expense')}
            className={`text-center transition-opacity ${
              filter === 'income' ? 'opacity-40' : ''
            }`}
          >
            <div className="text-xs text-[var(--text-tertiary)]">지출</div>
            <div className={`text-base font-bold ${filter !== 'income' ? 'text-grape-600' : 'text-[var(--text-muted)]'}`}>
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
            <div className={`text-base font-bold ${filter !== 'expense' ? 'text-leaf-600' : 'text-[var(--text-muted)]'}`}>
              {formatAmount(totalIncome)}
            </div>
          </button>
        </div>
      )}

      {/* 반복 거래 알림 (월 뷰 전용) */}
      {!isSearchMode && (
        <PendingRecurring
          items={pendingRecurring}
          onExecute={async (id) => {
            try {
              await recurringApi.execute(id)
              addToast('success', '거래가 등록되었습니다')
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
      )}

      {/* 미니 캘린더 (월 뷰 전용) */}
      {!isSearchMode && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-3">
          <MiniCalendar
            year={currentYear}
            month={currentMonth}
            daySummaries={daySummaries}
            onDateClick={handleDateClick}
            today={todayString}
          />
        </div>
      )}

      {/* 검색 모드 — 빈 검색어 안내 */}
      {isSearchMode && !searchQuery && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
          <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-tertiary)]">검색어를 입력하세요</p>
        </div>
      )}

      {/* 거래 리스트 (월 뷰 또는 검색어 입력 후) */}
      {(!isSearchMode || searchQuery) && (
        <>
          {loading ? (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
              {/* 스켈레톤 UI */}
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)]">
                    <div className="h-3 w-24 bg-[var(--surface-hover)] rounded animate-pulse" />
                  </div>
                  {[1, 2].map(j => (
                    <div key={j} className="px-4 py-3 space-y-2">
                      <div className="flex justify-between">
                        <div className="h-4 w-32 bg-[var(--border-subtle)] rounded animate-pulse" />
                        <div className="h-4 w-20 bg-[var(--border-subtle)] rounded animate-pulse" />
                      </div>
                      <div className="h-3 w-12 bg-[var(--border-subtle)] rounded-full animate-pulse" />
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
                        categoryMap={categoryMap}
                        excludeFromStats={tx.exclude_from_stats}
                        rawInput={tx.raw_input}
                        onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`)!}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
