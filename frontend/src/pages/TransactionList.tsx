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

// 최근 검색어 localStorage 관리
const RECENT_SEARCHES_KEY = 'podo-recent-searches'
const MAX_RECENT_SEARCHES = 5

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch {
    return []
  }
}

function addRecentSearch(query: string): void {
  const searches = getRecentSearches().filter(s => s !== query)
  searches.unshift(query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)))
}

function removeRecentSearch(query: string): void {
  const searches = getRecentSearches().filter(s => s !== query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches))
}

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
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches())

  // 검색 필터 URL 파라미터
  const searchType = (searchParams.get('type') as 'all' | 'expense' | 'income') || 'all'
  const searchCategoryId = searchParams.get('category') ? Number(searchParams.get('category')) : null
  const searchPeriod = (searchParams.get('period') as 'all' | '1m' | '3m' | '6m' | 'year') || 'all'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 검색 결과 상태
  const [searchResults, setSearchResults] = useState<UnifiedTransaction[]>([])
  const [searchSummary, setSearchSummary] = useState<{ total_count: number; total_amount: number } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // 검색 무한 스크롤 상태
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const searchOffsetRef = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const SEARCH_PAGE_SIZE = 30

  // 검색 필터 드롭다운 상태
  const [openFilter, setOpenFilter] = useState<'type' | 'period' | null>(null)
  // 카테고리 바텀시트: 검색 필터용 vs 거래 카테고리 변경용 구분
  const [isFilterCategorySheet, setIsFilterCategorySheet] = useState(false)

  // 카테고리 바텀시트 상태
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<UnifiedTransaction | null>(null)
  const [sheetSaving, setSheetSaving] = useState(false)

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!openFilter) return
    const handleClick = () => setOpenFilter(null)
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [openFilter])

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

  // 검색 모드 해제 → 월 뷰 복귀 (필터 파라미터도 전부 제거)
  const exitSearchMode = useCallback(() => {
    setParams({ search: null, type: null, category: null, period: null, member: null })
    setOpenFilter(null)
  }, [setParams])

  // 검색 실행
  const submitSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      setParams({ search: trimmed })
      addRecentSearch(trimmed)
      setRecentSearches(getRecentSearches())
    }
  }, [setParams])

  // 검색 필터 변경
  const setSearchFilter = useCallback((key: string, value: string | null) => {
    setParams({ [key]: value })
    setOpenFilter(null)
  }, [setParams])

  // 기간 프리셋 → 날짜 범위 계산
  const getSearchDateRange = useCallback((period: string): { start_date?: string; end_date?: string } => {
    if (period === 'all') return {}
    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    let start: Date
    switch (period) {
      case '1m': start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
      case '3m': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
      case '6m': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break
      case 'year': start = new Date(now.getFullYear(), 0, 1); break
      default: return {}
    }
    return { start_date: start.toISOString().slice(0, 10), end_date: end }
  }, [])

  // 검색 실행 (append=true: 무한 스크롤로 추가 로드)
  const fetchSearchResults = useCallback(async (append = false) => {
    if (!activeHouseholdId || !searchQuery) return

    if (append) {
      setSearchLoadingMore(true)
    } else {
      setSearchLoading(true)
      searchOffsetRef.current = 0
    }

    try {
      const offset = append ? searchOffsetRef.current : 0
      const dateRange = getSearchDateRange(searchPeriod)
      const baseParams = {
        query: searchQuery,
        skip: offset,
        limit: SEARCH_PAGE_SIZE,
        household_id: activeHouseholdId,
        ...dateRange,
        ...(searchCategoryId && { category_id: searchCategoryId }),
      }

      // 타입 필터: 해당 타입만 fetch
      const fetchExpenses = searchType !== 'income'
      const fetchIncomes = searchType !== 'expense'

      // 첫 로드: 데이터 + 합계, 추가 로드: 데이터만
      const promises: Promise<{ data: unknown }>[] = [
        fetchExpenses ? expenseApi.getAll(baseParams) : Promise.resolve({ data: [] as Expense[] }),
        fetchIncomes ? incomeApi.getAll(baseParams) : Promise.resolve({ data: [] as Income[] }),
      ]
      if (!append) {
        promises.push(
          fetchExpenses ? expenseApi.searchSummary(baseParams) : Promise.resolve({ data: { total_count: 0, total_amount: 0 } }),
          fetchIncomes ? incomeApi.searchSummary(baseParams) : Promise.resolve({ data: { total_count: 0, total_amount: 0 } }),
        )
      }

      const results = await Promise.all(promises)
      const expData = (results[0].data as Expense[]) ?? []
      const incData = (results[1].data as Income[]) ?? []

      const newItems: UnifiedTransaction[] = [
        ...expData.map(e => ({ ...e, type: 'expense' as const })),
        ...incData.map(i => ({ ...i, type: 'income' as const })),
      ]
      newItems.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)

      if (append) {
        setSearchResults(prev => [...prev, ...newItems])
      } else {
        setSearchResults(newItems)
        const expSummary = results[2].data as { total_count: number; total_amount: number }
        const incSummary = results[3].data as { total_count: number; total_amount: number }
        setSearchSummary({
          total_count: expSummary.total_count + incSummary.total_count,
          total_amount: expSummary.total_amount + incSummary.total_amount,
        })
      }

      searchOffsetRef.current = offset + SEARCH_PAGE_SIZE
      setSearchHasMore(newItems.length >= SEARCH_PAGE_SIZE)
    } catch {
      addToast('error', '검색에 실패했습니다')
    } finally {
      setSearchLoading(false)
      setSearchLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addToast는 안정적 참조
  }, [searchQuery, activeHouseholdId, searchType, searchCategoryId, searchPeriod, getSearchDateRange])

  // 검색어 변경 시 검색 실행
  useEffect(() => {
    if (isSearchMode && searchQuery) {
      fetchSearchResults()
    } else {
      setSearchResults([])
      setSearchSummary(null)
    }
  }, [isSearchMode, searchQuery, fetchSearchResults])

  // 검색 모드 진입 시 인풋 포커스
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchMode])

  // 무한 스크롤: IntersectionObserver로 sentinel 감지 → 추가 로드
  useEffect(() => {
    if (!loadMoreRef.current || !searchHasMore || searchLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchSearchResults(true)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [searchHasMore, searchLoadingMore, fetchSearchResults])

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

  // 검색 결과 날짜별 그룹핑
  const searchGrouped = useMemo(() => {
    const grouped = new Map<string, UnifiedTransaction[]>()
    for (const tx of searchResults) {
      const dateKey = tx.date.slice(0, 10)
      const group = grouped.get(dateKey)
      if (group) group.push(tx)
      else grouped.set(dateKey, [tx])
    }
    return grouped
  }, [searchResults])

  // TransactionItem.onCategoryClick 안정화 — 데이터 변경 시에만 재생성 (#240)
  const categoryClickHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>()
    const sources = isSearchMode && searchQuery ? searchGrouped : grouped
    for (const txs of sources.values()) {
      for (const tx of txs) {
        handlers.set(`${tx.type}-${tx.id}`, () => {
          setIsFilterCategorySheet(false)
          setSheetTarget(tx)
          setSheetOpen(true)
        })
      }
    }
    return handlers
  }, [grouped, searchGrouped, isSearchMode, searchQuery])

  // 캘린더 날짜 클릭 → 스크롤
  const handleDateClick = useCallback((dateString: string) => {
    const ref = dateRefs.current.get(dateString)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // 카테고리 변경 (거래 카테고리 수정 또는 검색 필터 설정)
  const handleCategorySelect = useCallback(async (categoryId: number | null) => {
    // 검색 필터용 카테고리 선택
    if (isFilterCategorySheet) {
      setSearchFilter('category', categoryId ? String(categoryId) : null)
      setSheetOpen(false)
      setIsFilterCategorySheet(false)
      return
    }
    // 거래 카테고리 변경
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addToast, setSearchFilter는 안정적 참조
  }, [sheetTarget, isFilterCategorySheet, setSearchFilter])

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

      {/* 검색 필터 칩 */}
      {isSearchMode && (
        <div className="flex gap-2 flex-wrap relative">
          {/* 지출/수입 */}
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                searchType !== 'all'
                  ? 'bg-grape-600 text-white'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              {searchType === 'all' ? '지출/수입' : searchType === 'expense' ? '지출만' : '수입만'}
            </button>
            {openFilter === 'type' && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] rounded-xl shadow-lg border border-[var(--border-default)] py-1 z-20 min-w-[120px]">
                {[
                  { value: 'all', label: '전체' },
                  { value: 'expense', label: '지출만' },
                  { value: 'income', label: '수입만' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSearchFilter('type', opt.value === 'all' ? null : opt.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] ${
                      searchType === opt.value ? 'text-grape-600 font-medium' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 카테고리 */}
          <button
            onClick={() => {
              if (searchCategoryId) {
                // 이미 선택된 상태 → 필터 해제
                setSearchFilter('category', null)
              } else {
                // 검색 필터용 바텀시트 열기
                setIsFilterCategorySheet(true)
                setSheetTarget(null)
                setSheetOpen(true)
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              searchCategoryId
                ? 'bg-grape-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            {searchCategoryId
              ? `${categoryMap.get(searchCategoryId)?.name ?? '카테고리'} ✕`
              : '카테고리'}
          </button>

          {/* 기간 */}
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpenFilter(openFilter === 'period' ? null : 'period')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                searchPeriod !== 'all'
                  ? 'bg-grape-600 text-white'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              {{ all: '기간: 전체', '1m': '최근 1개월', '3m': '최근 3개월', '6m': '최근 6개월', year: '올해' }[searchPeriod]}
            </button>
            {openFilter === 'period' && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] rounded-xl shadow-lg border border-[var(--border-default)] py-1 z-20 min-w-[130px]">
                {[
                  { value: 'all', label: '전체' },
                  { value: '1m', label: '최근 1개월' },
                  { value: '3m', label: '최근 3개월' },
                  { value: '6m', label: '최근 6개월' },
                  { value: 'year', label: '올해' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSearchFilter('period', opt.value === 'all' ? null : opt.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] ${
                      searchPeriod === opt.value ? 'text-grape-600 font-medium' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TODO: 멤버 필터 — 가구원 2인 이상일 때만 표시 (useHouseholdStore에 members 데이터 없어 보류) */}
        </div>
      )}

      {/* 검색 모드 — 빈 검색어: 최근 검색 + 카테고리 바로가기 */}
      {isSearchMode && !searchQuery && (
        <div className="space-y-4">
          {/* 최근 검색 */}
          {recentSearches.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">최근 검색</h3>
              <div className="space-y-1">
                {recentSearches.map(query => (
                  <div key={query} className="flex items-center justify-between group">
                    <button
                      onClick={() => submitSearch(query)}
                      className="flex-1 text-left py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {query}
                    </button>
                    <button
                      onClick={() => {
                        removeRecentSearch(query)
                        setRecentSearches(getRecentSearches())
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-opacity"
                      aria-label={`${query} 삭제`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 카테고리 바로가기 */}
          {categories.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">카테고리로 보기</h3>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 8).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSearchFilter('category', String(cat.id))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-grape-50 hover:text-grape-600 transition-colors"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 최근 검색도 카테고리도 없을 때 기본 안내 */}
          {recentSearches.length === 0 && categories.length === 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
              <p className="text-sm text-[var(--text-tertiary)]">검색어를 입력하세요</p>
            </div>
          )}
        </div>
      )}

      {/* 검색 결과 합계 바 */}
      {isSearchMode && searchQuery && searchSummary && !searchLoading && (
        <div className="px-1 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">&ldquo;{searchQuery}&rdquo;</span>
          {' \u00b7 '}
          {searchSummary.total_count}건
          {' \u00b7 총 '}
          {formatAmount(searchSummary.total_amount)}
        </div>
      )}

      {/* 검색 결과 리스트 */}
      {isSearchMode && searchQuery && (
        searchLoading ? (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
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
        ) : searchGrouped.size === 0 ? (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
            <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
            <p className="text-sm text-[var(--text-primary)] font-medium mb-1">검색 결과가 없습니다</p>
            <p className="text-xs text-[var(--text-tertiary)]">다른 검색어를 시도해보세요</p>
          </div>
        ) : (
          <>
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
              {Array.from(searchGrouped.entries()).map(([dateKey, txs]) => (
                <div key={dateKey}>
                  <div className="bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {formatDateHeader(dateKey)}
                    </span>
                  </div>
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
                        onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`) ?? (() => {})}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 무한 스크롤 sentinel */}
            {searchHasMore && (
              <div ref={loadMoreRef} data-testid="search-load-more" className="py-4 text-center">
                {searchLoadingMore ? (
                  <div className="animate-spin rounded-full border-b-2 border-grape-600 w-5 h-5 mx-auto" />
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">스크롤하여 더 보기</span>
                )}
              </div>
            )}

            {/* 모든 결과 로드 완료 */}
            {!searchHasMore && searchResults.length > 0 && (
              <p className="text-center text-xs text-[var(--text-muted)] py-2">
                모든 검색 결과를 불러왔습니다
              </p>
            )}
          </>
        )
      )}

      {/* 월 뷰 거래 리스트 (검색 모드가 아닐 때만) */}
      {!isSearchMode && (
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
        onClose={() => { setSheetOpen(false); setIsFilterCategorySheet(false) }}
        onSelect={handleCategorySelect}
        categories={categories}
        currentCategoryId={isFilterCategorySheet ? searchCategoryId : (sheetTarget?.category_id ?? null)}
        transactionType={isFilterCategorySheet
          ? (searchType === 'income' ? 'income' : 'expense')
          : (sheetTarget?.type ?? 'expense')}
        saving={sheetSaving}
        title={isFilterCategorySheet ? '카테고리 선택' : undefined}
      />
    </div>
    </PullToRefresh>
  )
}
