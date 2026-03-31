/**
 * @file SearchMode.tsx
 * @description 검색 모드 UI — 검색 바, 필터 칩, 최근 검색, 검색 결과 리스트, 무한 스크롤
 * TransactionList에서 검색 관련 JSX를 분리한 컴포넌트.
 */

/* eslint-disable react-hooks/refs -- search 훅이 반환하는 객체 내 refs와 값을 함께 사용하므로 린터 오탐 발생 */

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import TransactionItem from '../TransactionItem'
import { formatAmount } from '../../utils/format'
import { formatDateHeader } from '../../utils/calendar'
import { getRecentSearches, removeRecentSearch } from '../../hooks/useTransactionSearch'
import type { useTransactionSearch } from '../../hooks/useTransactionSearch'
import type { useMonthlyTransactions } from '../../hooks/useMonthlyTransactions'

interface SearchModeProps {
  search: ReturnType<typeof useTransactionSearch>
  monthly: ReturnType<typeof useMonthlyTransactions>
  categoryClickHandlers: Map<string, () => void>
  onOpenFilterCategorySheet: () => void
  onClearFilterCategory: () => void
  searchCategoryActive: boolean
  /** 멀티멤버 가구의 user_id → username 매핑 (단독 가구는 null) */
  memberMap: Map<number, string> | null
}

export default function SearchMode({
  search,
  monthly,
  categoryClickHandlers,
  onOpenFilterCategorySheet,
  onClearFilterCategory,
  searchCategoryActive,
  memberMap,
}: SearchModeProps) {
  // 카테고리 필터 칩 라벨
  const categoryChipLabel = useMemo(() => {
    if (search.searchCategoryId) {
      return `${monthly.categoryMap.get(search.searchCategoryId)?.name ?? '카테고리'} \u2715`
    }
    return '카테고리'
  }, [search.searchCategoryId, monthly.categoryMap])

  return (
    <>
      {/* 검색 바 */}
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

      {/* 검색 필터 칩 */}
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
              onClearFilterCategory()
            } else {
              onOpenFilterCategorySheet()
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            searchCategoryActive
              ? 'bg-grape-600 text-white'
              : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
          }`}
        >
          {categoryChipLabel}
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
      </div>

      {/* 빈 검색어: 최근 검색 + 카테고리 바로가기 */}
      {!search.searchQuery && !search.hasSearchFilters && (
        <div className="space-y-4">
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

          {search.recentSearches.length === 0 && monthly.categories.length === 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-12 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
              <p className="text-sm text-[var(--text-tertiary)]">검색어를 입력하세요</p>
            </div>
          )}
        </div>
      )}

      {/* 검색 결과 합계 바 */}
      {(search.searchQuery || search.hasSearchFilters) && search.searchSummary && !search.searchLoading && (
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
      {(search.searchQuery || search.hasSearchFilters) && (
        search.searchLoading ? (
          <SearchSkeleton />
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
                        recurringTransactionId={tx.recurring_transaction_id}
                        onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`) ?? (() => {})}
                        recordedBy={memberMap && tx.user_id != null ? memberMap.get(tx.user_id) : undefined}
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
    </>
  )
}

/** 검색 결과 로딩 스켈레톤 */
function SearchSkeleton() {
  return (
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
  )
}
