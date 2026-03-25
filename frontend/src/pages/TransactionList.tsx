/**
 * @file TransactionList.tsx
 * @description 통합 거래 목록 페이지 — 월별 캘린더 + 날짜별 그룹핑
 * 검색 로직은 useTransactionSearch, 월별 데이터는 useMonthlyTransactions에 위임한다.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import PeriodNavigator from '../components/stats/PeriodNavigator'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { recurringApi } from '../api/recurring'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import MiniCalendar from '../components/MiniCalendar'
import TransactionItem from '../components/TransactionItem'
import PendingRecurring from '../components/PendingRecurring'
import CategoryBottomSheet from '../components/CategoryBottomSheet'
import PullToRefresh from '../components/PullToRefresh'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { formatAmount } from '../utils/format'
import { formatDateHeader } from '../utils/calendar'
import { Search, X } from 'lucide-react'
import WelcomeCard from '../components/WelcomeCard'
import { useAuth } from '../contexts/AuthContext'
import { useTransactionSearch, getRecentSearches, removeRecentSearch } from '../hooks/useTransactionSearch'
import type { UnifiedTransaction } from '../hooks/useTransactionSearch'
import { useMonthlyTransactions } from '../hooks/useMonthlyTransactions'

export default function TransactionList() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const { addToast } = useToast()
  const { user } = useAuth()

  // 월별 거래 데이터 훅
  const monthly = useMonthlyTransactions({ activeHouseholdId })

  // 검색 훅
  const search = useTransactionSearch({ activeHouseholdId })

  // 웰컴 카드 상태
  const [welcomeDismissed, setWelcomeDismissed] = useState(() =>
    localStorage.getItem('podo-welcome-dismissed') === 'true'
  )
  const [totalTransactionCount, setTotalTransactionCount] = useState(0)

  // 전체 기간 거래 건수 조회 (웰컴 카드 단계 판정용)
  useEffect(() => {
    if (welcomeDismissed || !activeHouseholdId) return
    Promise.all([
      expenseApi.getAll({ household_id: activeHouseholdId, limit: 3 }).catch(() => ({ data: [] })),
      incomeApi.getAll({ household_id: activeHouseholdId, limit: 3 }).catch(() => ({ data: [] })),
    ]).then(([expRes, incRes]) => {
      setTotalTransactionCount(expRes.data.length + incRes.data.length)
    })
  }, [welcomeDismissed, activeHouseholdId])

  const handleWelcomeDismiss = useCallback(() => {
    setWelcomeDismissed(true)
    localStorage.setItem('podo-welcome-dismissed', 'true')
  }, [])

  // 웰컴 카드 단계 갱신 — 거래 추가 후 돌아왔을 때 반영
  useEffect(() => {
    if (!welcomeDismissed && !monthly.loading) {
      setTotalTransactionCount(prev =>
        Math.max(prev, monthly.expenses.length + monthly.incomes.length)
      )
    }
  }, [welcomeDismissed, monthly.loading, monthly.expenses.length, monthly.incomes.length])

  // 카테고리 바텀시트 상태
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<UnifiedTransaction | null>(null)
  const [sheetSaving, setSheetSaving] = useState(false)
  // 카테고리 바텀시트: 검색 필터용 vs 거래 카테고리 변경용 구분
  const [isFilterCategorySheet, setIsFilterCategorySheet] = useState(false)

  // 날짜 섹션 ref 맵
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const todayString = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  // TransactionItem.onCategoryClick 안정화
  const categoryClickHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>()

    if (search.isSearchMode) {
      for (const txs of search.searchGrouped.values()) {
        for (const tx of txs) {
          handlers.set(`${tx.type}-${tx.id}`, () => {
            if (tx.category_id) {
              setIsFilterCategorySheet(false)
              search.setSearchFilter('category',
                search.searchCategoryId === tx.category_id ? null : String(tx.category_id))
            }
          })
        }
      }
    } else {
      for (const txs of monthly.grouped.values()) {
        for (const tx of txs) {
          handlers.set(`${tx.type}-${tx.id}`, () => {
            setIsFilterCategorySheet(false)
            setSheetTarget(tx)
            setSheetOpen(true)
          })
        }
      }
    }
    return handlers
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchFilter는 useCallback 안정 참조
  }, [monthly.grouped, search.searchGrouped, search.isSearchMode, search.searchCategoryId])

  // 캘린더 날짜 클릭 → 스크롤
  const handleDateClick = useCallback((dateString: string) => {
    const ref = dateRefs.current.get(dateString)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // 카테고리 변경 (거래 카테고리 수정 또는 검색 필터 설정)
  const handleCategorySelect = useCallback(async (categoryId: number | null) => {
    if (isFilterCategorySheet) {
      search.setSearchFilter('category', categoryId ? String(categoryId) : null)
      setSheetOpen(false)
      setIsFilterCategorySheet(false)
      return
    }
    if (!sheetTarget) return
    setSheetSaving(true)
    try {
      if (sheetTarget.type === 'expense') {
        await expenseApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        monthly.setExpenses(prev => prev.map(e =>
          e.id === sheetTarget.id ? { ...e, category_id: categoryId } : e
        ))
      } else {
        await incomeApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        monthly.setIncomes(prev => prev.map(i =>
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
  }, [sheetTarget, isFilterCategorySheet, search.setSearchFilter])

  const { fetchData } = monthly
  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  if (monthly.error) {
    return (
      <div className="space-y-4">
        <ErrorState onRetry={monthly.fetchData} />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4">
      {/* 월 네비게이션 / 검색 바 */}
      {search.isSearchMode ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              key={search.searchQuery}
              ref={search.searchInputRef}
              type="search"
              defaultValue={search.searchQuery}
              placeholder="거래 내역 검색"
              onKeyDown={(e) => {
                if (e.key === 'Enter') search.submitSearch(e.currentTarget.value)
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
            />
          </div>
          <button
            onClick={search.exitSearchMode}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="검색 닫기"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <PeriodNavigator label={monthly.monthLabel} onPrev={() => monthly.navigateMonth(-1)} onNext={() => monthly.navigateMonth(1)} />
          <button
            onClick={search.enterSearchMode}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="검색"
          >
            <Search className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      )}

      {/* 요약 + 필터 (월 뷰 전용) */}
      {!search.isSearchMode && (
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => monthly.toggleFilter('expense')}
            className={`text-center transition-opacity ${
              monthly.filter === 'income' ? 'opacity-40' : ''
            }`}
          >
            <div className="text-xs text-[var(--text-tertiary)]">지출</div>
            <div className={`text-base font-bold ${monthly.filter !== 'income' ? 'text-grape-600' : 'text-[var(--text-muted)]'}`}>
              {formatAmount(monthly.totalExpense)}
            </div>
          </button>
          <div className="w-px h-8 bg-[var(--border-default)]" />
          <button
            onClick={() => monthly.toggleFilter('income')}
            className={`text-center transition-opacity ${
              monthly.filter === 'expense' ? 'opacity-40' : ''
            }`}
          >
            <div className="text-xs text-[var(--text-tertiary)]">수입</div>
            <div className={`text-base font-bold ${monthly.filter !== 'expense' ? 'text-leaf-600' : 'text-[var(--text-muted)]'}`}>
              {formatAmount(monthly.totalIncome)}
            </div>
          </button>
        </div>
      )}

      {/* 온보딩 웰컴 카드 */}
      {!welcomeDismissed && !monthly.loading && !search.isSearchMode && (
        <WelcomeCard
          transactionCount={Math.max(totalTransactionCount, monthly.expenses.length + monthly.incomes.length)}
          isBotLinked={!!user?.is_telegram_linked || !!user?.is_kakao_linked}
          onDismiss={handleWelcomeDismiss}
        />
      )}

      {/* 반복 거래 알림 (월 뷰 전용) */}
      {!search.isSearchMode && (
        <PendingRecurring
          items={monthly.pendingRecurring}
          onExecute={async (id) => {
            try {
              await recurringApi.execute(id)
              addToast('success', '거래가 등록되었습니다')
              monthly.setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
              monthly.fetchData()
            } catch {
              addToast('error', '반복 거래 등록에 실패했습니다')
            }
          }}
          onSkip={async (id) => {
            try {
              const res = await recurringApi.skip(id)
              addToast('success', `다음 예정일: ${res.data.next_due_date}`)
              monthly.setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
            } catch {
              addToast('error', '건너뛰기에 실패했습니다')
            }
          }}
        />
      )}

      {/* 미니 캘린더 (월 뷰 전용) */}
      {!search.isSearchMode && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-3">
          <MiniCalendar
            year={monthly.currentYear}
            month={monthly.currentMonth}
            daySummaries={monthly.daySummaries}
            onDateClick={handleDateClick}
            today={todayString}
          />
        </div>
      )}

      {/* 검색 필터 칩 */}
      {search.isSearchMode && (
        <div className="flex gap-2 flex-wrap relative">
          {/* 지출/수입 */}
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => search.setOpenFilter(search.openFilter === 'type' ? null : 'type')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                search.searchType !== 'all'
                  ? 'bg-grape-600 text-white'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              {search.searchType === 'all' ? '지출/수입' : search.searchType === 'expense' ? '지출만' : '수입만'}
            </button>
            {search.openFilter === 'type' && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] rounded-xl shadow-lg border border-[var(--border-default)] py-1 z-20 min-w-[120px]">
                {[
                  { value: 'all', label: '전체' },
                  { value: 'expense', label: '지출만' },
                  { value: 'income', label: '수입만' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => search.setSearchFilter('type', opt.value === 'all' ? null : opt.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] ${
                      search.searchType === opt.value ? 'text-grape-600 font-medium' : 'text-[var(--text-primary)]'
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
              if (search.searchCategoryId) {
                search.setSearchFilter('category', null)
              } else {
                setIsFilterCategorySheet(true)
                setSheetTarget(null)
                setSheetOpen(true)
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              search.searchCategoryId
                ? 'bg-grape-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            {search.searchCategoryId
              ? `${monthly.categoryMap.get(search.searchCategoryId)?.name ?? '카테고리'} ✕`
              : '카테고리'}
          </button>

          {/* 기간 */}
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => search.setOpenFilter(search.openFilter === 'period' ? null : 'period')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                search.searchPeriod !== 'all'
                  ? 'bg-grape-600 text-white'
                  : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              {{ all: '기간: 전체', '1m': '최근 1개월', '3m': '최근 3개월', '6m': '최근 6개월', year: '올해' }[search.searchPeriod]}
            </button>
            {search.openFilter === 'period' && (
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
                    onClick={() => search.setSearchFilter('period', opt.value === 'all' ? null : opt.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-hover)] ${
                      search.searchPeriod === opt.value ? 'text-grape-600 font-medium' : 'text-[var(--text-primary)]'
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
      {search.isSearchMode && !search.searchQuery && !search.hasSearchFilters && (
        <div className="space-y-4">
          {/* 최근 검색 */}
          {search.recentSearches.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">최근 검색</h3>
              <div className="space-y-1">
                {search.recentSearches.map(query => (
                  <div key={query} className="flex items-center justify-between group">
                    <button
                      onClick={() => search.submitSearch(query)}
                      className="flex-1 text-left py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {query}
                    </button>
                    <button
                      onClick={() => {
                        removeRecentSearch(query)
                        search.setRecentSearches(getRecentSearches())
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
          {monthly.categories.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">카테고리로 보기</h3>
              <div className="flex flex-wrap gap-2">
                {monthly.categories.slice(0, 8).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => search.setSearchFilter('category', String(cat.id))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-grape-50 hover:text-grape-600 transition-colors"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 최근 검색도 카테고리도 없을 때 기본 안내 */}
          {search.recentSearches.length === 0 && monthly.categories.length === 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
              <p className="text-sm text-[var(--text-tertiary)]">검색어를 입력하세요</p>
            </div>
          )}
        </div>
      )}

      {/* 검색 결과 합계 바 */}
      {search.isSearchMode && (search.searchQuery || search.hasSearchFilters) && search.searchSummary && !search.searchLoading && (
        <div className="px-1 text-sm text-[var(--text-secondary)]">
          {search.searchQuery ? (
            <span className="font-medium text-[var(--text-primary)]">&ldquo;{search.searchQuery}&rdquo;</span>
          ) : (
            <span className="font-medium text-[var(--text-primary)]">필터 검색</span>
          )}
          {' \u00b7 '}
          {search.searchSummary.total_count}건
          {' \u00b7 총 '}
          {formatAmount(search.searchSummary.total_amount)}
        </div>
      )}

      {/* 검색 결과 리스트 */}
      {search.isSearchMode && (search.searchQuery || search.hasSearchFilters) && (
        search.searchLoading ? (
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
        ) : search.searchGrouped.size === 0 ? (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
            <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
            <p className="text-sm text-[var(--text-primary)] font-medium mb-1">검색 결과가 없습니다</p>
            <p className="text-xs text-[var(--text-tertiary)]">다른 검색어를 시도해보세요</p>
          </div>
        ) : (
          <>
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
              {Array.from(search.searchGrouped.entries()).map(([dateKey, txs]) => (
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
                        categoryMap={monthly.categoryMap}
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
            {search.searchHasMore && (
              <div ref={search.loadMoreRef} data-testid="search-load-more" className="py-4 text-center">
                {search.searchLoadingMore ? (
                  <div className="animate-spin rounded-full border-b-2 border-grape-600 w-5 h-5 mx-auto" />
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">스크롤하여 더 보기</span>
                )}
              </div>
            )}

            {/* 모든 결과 로드 완료 */}
            {!search.searchHasMore && search.searchResults.length > 0 && (
              <p className="text-center text-xs text-[var(--text-muted)] py-2">
                모든 검색 결과를 불러왔습니다
              </p>
            )}
          </>
        )
      )}

      {/* 월 뷰 거래 리스트 (검색 모드가 아닐 때만) */}
      {!search.isSearchMode && (
        <>
          {monthly.loading ? (
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
          ) : monthly.grouped.size === 0 ? (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
              <EmptyState
                title={monthly.filter === 'all' ? '거래 내역이 없습니다' : `${monthly.filter === 'expense' ? '지출' : '수입'} 내역이 없습니다`}
                description="이번 달의 거래를 추가해보세요."
              />
            </div>
          ) : (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
              {Array.from(monthly.grouped.entries()).map(([dateKey, txs]) => (
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
                        categoryMap={monthly.categoryMap}
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
        categories={monthly.categories}
        currentCategoryId={isFilterCategorySheet ? search.searchCategoryId : (sheetTarget?.category_id ?? null)}
        transactionType={isFilterCategorySheet
          ? (search.searchType === 'income' ? 'income' : 'expense')
          : (sheetTarget?.type ?? 'expense')}
        saving={sheetSaving}
        title={isFilterCategorySheet ? '카테고리 선택' : undefined}
      />
    </div>
    </PullToRefresh>
  )
}
