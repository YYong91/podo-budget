/**
 * @file SearchModeDateRange.test.tsx
 * @description SearchMode 기간 직접 입력(custom date range) 기능 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchMode from '../SearchMode'
import type { useTransactionSearch } from '../../../hooks/useTransactionSearch'
import type { useMonthlyTransactions } from '../../../hooks/useMonthlyTransactions'

// SearchMode가 받는 search prop의 최소 mock 객체
function makeSearchMock(overrides: Partial<ReturnType<typeof useTransactionSearch>> = {}): ReturnType<typeof useTransactionSearch> {
  return {
    searchQuery: '',
    isSearchMode: true,
    searchType: 'all',
    searchCategoryId: null,
    searchPeriod: 'all',
    searchStartDate: '',
    searchEndDate: '',
    searchMinAmount: null,
    searchMaxAmount: null,
    amountActive: false,
    hasSearchFilters: false,
    searchResults: [],
    searchSummary: null,
    searchLoading: false,
    searchGrouped: new Map(),
    searchHasMore: false,
    searchLoadingMore: false,
    loadMoreRef: { current: null },
    searchInputRef: { current: null },
    recentSearches: [],
    setRecentSearches: vi.fn(),
    openFilter: null,
    setOpenFilter: vi.fn(),
    setParams: vi.fn(),
    enterSearchMode: vi.fn(),
    exitSearchMode: vi.fn(),
    submitSearch: vi.fn(),
    setSearchFilter: vi.fn(),
    setCustomDateRange: vi.fn(),
    setAmountRange: vi.fn(),
    fetchSearchResults: vi.fn(),
    ...overrides,
  }
}

function makeMonthlyMock(): Partial<ReturnType<typeof useMonthlyTransactions>> {
  return {
    categoryMap: new Map(),
    categories: [],
  }
}

const defaultProps = {
  categoryClickHandlers: new Map(),
  onOpenFilterCategorySheet: vi.fn(),
  onClearFilterCategory: vi.fn(),
  searchCategoryActive: false,
  memberMap: null,
}

describe('SearchMode — 기간 직접 입력', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('기간 칩 드롭다운에 "직접 입력" 옵션이 있다', () => {
    const search = makeSearchMock({ openFilter: 'period' })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    expect(screen.getByRole('button', { name: '직접 입력' })).toBeInTheDocument()
  })

  it('"직접 입력" 선택 시 setSearchFilter("period", "custom") 호출된다', async () => {
    const user = userEvent.setup()
    const search = makeSearchMock({ openFilter: 'period' })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    await user.click(screen.getByRole('button', { name: '직접 입력' }))
    expect(search.setSearchFilter).toHaveBeenCalledWith('period', 'custom')
  })

  it('searchPeriod가 custom이면 날짜 범위 인풋이 표시된다', () => {
    const search = makeSearchMock({ searchPeriod: 'custom', searchStartDate: '', searchEndDate: '' })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    expect(screen.getByLabelText('시작일')).toBeInTheDocument()
    expect(screen.getByLabelText('종료일')).toBeInTheDocument()
  })

  it('날짜 입력 후 적용 버튼 클릭 시 setCustomDateRange 호출된다', async () => {
    const user = userEvent.setup()
    const search = makeSearchMock({ searchPeriod: 'custom', searchStartDate: '', searchEndDate: '' })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    await user.type(screen.getByLabelText('시작일'), '2026-03-01')
    await user.type(screen.getByLabelText('종료일'), '2026-03-31')
    await user.click(screen.getByRole('button', { name: '적용' }))
    expect(search.setCustomDateRange).toHaveBeenCalledWith('2026-03-01', '2026-03-31')
  })

  it('custom 기간 선택 + 날짜 있을 때 칩이 날짜 범위 텍스트를 표시한다', () => {
    const search = makeSearchMock({
      searchPeriod: 'custom',
      searchStartDate: '2026-03-01',
      searchEndDate: '2026-03-31',
      hasSearchFilters: true,
    })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    expect(screen.getByText('03.01 ~ 03.31')).toBeInTheDocument()
  })

  it('custom 기간이지만 날짜 미입력 시 칩이 "직접 입력" 텍스트를 표시한다', () => {
    const search = makeSearchMock({ searchPeriod: 'custom', searchStartDate: '', searchEndDate: '' })
    render(
      <SearchMode
        search={search}
        monthly={makeMonthlyMock() as ReturnType<typeof useMonthlyTransactions>}
        {...defaultProps}
      />
    )
    // 칩 버튼(기간 토글)에 "직접 입력" 텍스트
    expect(screen.getByRole('button', { name: /직접 입력/ })).toBeInTheDocument()
  })
})
