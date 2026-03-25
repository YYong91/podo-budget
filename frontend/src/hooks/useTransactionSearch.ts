/**
 * @file useTransactionSearch.ts
 * @description 거래 검색 로직 훅 — 검색 state, URL 파라미터, 무한스크롤, 최근 검색어 관리
 * TransactionList에서 검색 관련 로직을 추출하여 단일 책임 원칙을 따른다.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { useToast } from './useToast'
import { getLocalDateString } from '../utils/format'
import type { Expense, Income } from '../types'

// 최근 검색어 localStorage 관리
const RECENT_SEARCHES_KEY = 'podo-recent-searches'
const MAX_RECENT_SEARCHES = 5
const SEARCH_PAGE_SIZE = 30

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

export function getRecentSearches(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addRecentSearch(query: string): void {
  const searches = getRecentSearches().filter(s => s !== query)
  searches.unshift(query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)))
}

export function removeRecentSearch(query: string): void {
  const searches = getRecentSearches().filter(s => s !== query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches))
}

/** 기간 프리셋 → 날짜 범위 계산 */
function getSearchDateRange(period: string): { start_date?: string; end_date?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const end = getLocalDateString(now)
  let start: Date
  switch (period) {
    case '1m': start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
    case '3m': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
    case '6m': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break
    case 'year': start = new Date(now.getFullYear(), 0, 1); break
    default: return {}
  }
  return { start_date: getLocalDateString(start), end_date: end }
}

interface UseTransactionSearchOptions {
  activeHouseholdId: number | null
}

export function useTransactionSearch({ activeHouseholdId }: UseTransactionSearchOptions) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()

  // URL 파라미터 읽기
  const searchQuery = searchParams.get('search') ?? ''
  const isSearchMode = searchParams.has('search')
  const searchType = (searchParams.get('type') as 'all' | 'expense' | 'income') || 'all'
  const searchCategoryId = searchParams.get('category') ? Number(searchParams.get('category')) : null
  const searchPeriod = (searchParams.get('period') as 'all' | '1m' | '3m' | '6m' | 'year') || 'all'
  const hasSearchFilters = !!(searchCategoryId || searchPeriod !== 'all' || searchType !== 'all')

  // 검색 결과 상태
  const [searchResults, setSearchResults] = useState<UnifiedTransaction[]>([])
  const [searchSummary, setSearchSummary] = useState<{ total_count: number; total_amount: number } | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // 무한 스크롤 상태
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const searchOffsetRef = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 최근 검색어
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches())

  // 검색 필터 드롭다운 상태
  const [openFilter, setOpenFilter] = useState<'type' | 'period' | null>(null)

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

  // 검색 모드 진입
  const enterSearchMode = useCallback(() => {
    setParams({ search: '', month: null, filter: null })
  }, [setParams])

  // 검색 모드 해제 → 월 뷰 복귀
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

  // 검색 API 호출 (append=true: 무한 스크롤 추가 로드)
  const fetchSearchResults = useCallback(async (append = false) => {
    if (!activeHouseholdId || (!searchQuery && !hasSearchFilters)) return

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
        query: searchQuery || undefined,
        skip: offset,
        limit: SEARCH_PAGE_SIZE,
        household_id: activeHouseholdId,
        ...dateRange,
        ...(searchCategoryId && { category_id: searchCategoryId }),
      }

      const fetchExpenses = searchType !== 'income'
      const fetchIncomes = searchType !== 'expense'

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
  }, [searchQuery, activeHouseholdId, searchType, searchCategoryId, searchPeriod])

  // 검색어 또는 필터 변경 시 검색 실행
  useEffect(() => {
    if (isSearchMode) {
      if (searchQuery || hasSearchFilters) {
        fetchSearchResults()
      } else {
        setSearchResults([])
        setSearchSummary(null)
      }
    } else {
      setSearchResults([])
      setSearchSummary(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSearchResults 내부에서 동일 state 참조
  }, [isSearchMode, searchQuery, searchType, searchCategoryId, searchPeriod])

  // 검색 모드 진입 시 인풋 포커스
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchMode])

  // 무한 스크롤: IntersectionObserver
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

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!openFilter) return
    const handleClick = () => setOpenFilter(null)
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [openFilter])

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

  return {
    // URL 상태
    searchQuery,
    isSearchMode,
    searchType,
    searchCategoryId,
    searchPeriod,
    hasSearchFilters,

    // 검색 결과
    searchResults,
    searchSummary,
    searchLoading,
    searchGrouped,

    // 무한 스크롤
    searchHasMore,
    searchLoadingMore,
    loadMoreRef,

    // 최근 검색어
    searchInputRef,
    recentSearches,
    setRecentSearches,

    // 필터 드롭다운
    openFilter,
    setOpenFilter,

    // 액션
    setParams,
    enterSearchMode,
    exitSearchMode,
    submitSearch,
    setSearchFilter,
    fetchSearchResults,
  }
}
