/**
 * @file useTransactionSearch.test.ts
 * @description useTransactionSearch 훅 테스트 — 검색 상태, URL 파라미터, 최근 검색어 관리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// react-router-dom mock
const mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn((updater: (prev: URLSearchParams) => URLSearchParams) => {
  if (typeof updater === 'function') {
    const result = updater(mockSearchParams)
    // 반영: 실제 URL 파라미터 시뮬레이션
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
    result.forEach((v, k) => mockSearchParams.set(k, v))
  }
})

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

import {
  useTransactionSearch,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
} from '../useTransactionSearch'

describe('useTransactionSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
    localStorage.clear()
  })

  describe('초기 상태', () => {
    it('검색 모드가 아닌 기본 상태로 시작', () => {
      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchResults).toEqual([])
      expect(result.current.searchSummary).toBeNull()
      expect(result.current.searchLoading).toBe(false)
    })

    it('URL에 search 파라미터가 있으면 검색 모드', () => {
      mockSearchParams.set('search', '김치')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.isSearchMode).toBe(true)
      expect(result.current.searchQuery).toBe('김치')
    })
  })

  describe('검색 필터 상태', () => {
    it('URL에서 type 필터를 읽는다', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('type', 'expense')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.searchType).toBe('expense')
    })

    it('URL에서 category 필터를 읽는다', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('category', '3')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.searchCategoryId).toBe(3)
    })

    it('URL에서 period 필터를 읽는다', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('period', '3m')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.searchPeriod).toBe('3m')
    })

    it('필터가 있으면 hasSearchFilters가 true', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('type', 'income')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.hasSearchFilters).toBe(true)
    })

    it('custom 기간이지만 날짜 미입력이면 hasSearchFilters가 false', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('period', 'custom')
      // start_date, end_date 없음

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.hasSearchFilters).toBe(false)
    })

    it('custom 기간 + 날짜 입력 시 hasSearchFilters가 true', () => {
      mockSearchParams.set('search', '')
      mockSearchParams.set('period', 'custom')
      mockSearchParams.set('start_date', '2026-01-01')
      mockSearchParams.set('end_date', '2026-01-31')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      expect(result.current.hasSearchFilters).toBe(true)
    })
  })

  describe('검색 모드 진입/해제', () => {
    it('enterSearchMode가 search 파라미터를 설정한다', () => {
      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      act(() => result.current.enterSearchMode())

      expect(mockSetSearchParams).toHaveBeenCalled()
    })

    it('exitSearchMode가 search 관련 파라미터를 제거한다', () => {
      mockSearchParams.set('search', '테스트')
      mockSearchParams.set('type', 'expense')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      act(() => result.current.exitSearchMode())

      expect(mockSetSearchParams).toHaveBeenCalled()
    })
  })

  describe('검색 실행', () => {
    it('submitSearch가 비어있지 않은 검색어를 URL에 설정한다', () => {
      mockSearchParams.set('search', '')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      act(() => result.current.submitSearch('김치찌개'))

      expect(mockSetSearchParams).toHaveBeenCalled()
    })

    it('submitSearch가 빈 검색어는 무시한다', () => {
      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      const callCount = mockSetSearchParams.mock.calls.length
      act(() => result.current.submitSearch('   '))

      expect(mockSetSearchParams.mock.calls.length).toBe(callCount)
    })

    it('fetchSearchResults가 검색 API를 호출하고 결과를 설정한다', async () => {
      mockSearchParams.set('search', '김치')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      // MSW가 처리하므로 실제 API 호출됨
      await act(async () => {
        await result.current.fetchSearchResults()
      })

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false)
      })

      // MSW fixture에 '김치찌개'가 있으므로 결과가 존재해야 함
      expect(result.current.searchResults.length).toBeGreaterThan(0)
      expect(result.current.searchSummary).not.toBeNull()
    })

    it('activeHouseholdId가 없으면 fetchSearchResults가 실행되지 않는다', async () => {
      mockSearchParams.set('search', '김치')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: null })
      )

      await act(async () => {
        await result.current.fetchSearchResults()
      })

      expect(result.current.searchResults).toEqual([])
    })
  })

  describe('검색 결과 그룹핑', () => {
    it('searchGrouped가 날짜별로 결과를 그룹핑한다', async () => {
      mockSearchParams.set('search', '김치')

      const { result } = renderHook(() =>
        useTransactionSearch({ activeHouseholdId: 1 })
      )

      await act(async () => {
        await result.current.fetchSearchResults()
      })

      await waitFor(() => {
        expect(result.current.searchGrouped.size).toBeGreaterThan(0)
      })

      // 모든 그룹의 키가 YYYY-MM-DD 형식인지 확인
      for (const key of result.current.searchGrouped.keys()) {
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })
})

describe('최근 검색어 관리', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getRecentSearches가 빈 배열을 반환한다 (초기 상태)', () => {
    expect(getRecentSearches()).toEqual([])
  })

  it('addRecentSearch가 검색어를 추가한다', () => {
    addRecentSearch('김치찌개')
    expect(getRecentSearches()).toEqual(['김치찌개'])
  })

  it('addRecentSearch가 중복을 제거하고 최신을 앞에 배치한다', () => {
    addRecentSearch('김치찌개')
    addRecentSearch('된장찌개')
    addRecentSearch('김치찌개')
    expect(getRecentSearches()).toEqual(['김치찌개', '된장찌개'])
  })

  it('addRecentSearch가 최대 5개까지만 유지한다', () => {
    for (let i = 0; i < 7; i++) {
      addRecentSearch(`검색어${i}`)
    }
    expect(getRecentSearches().length).toBe(5)
    expect(getRecentSearches()[0]).toBe('검색어6')
  })

  it('removeRecentSearch가 특정 검색어를 제거한다', () => {
    addRecentSearch('김치찌개')
    addRecentSearch('된장찌개')
    removeRecentSearch('김치찌개')
    expect(getRecentSearches()).toEqual(['된장찌개'])
  })

  it('localStorage가 깨진 데이터여도 빈 배열을 반환한다', () => {
    localStorage.setItem('podo-recent-searches', '{invalid}')
    expect(getRecentSearches()).toEqual([])
  })
})

describe('금액 범위 필터', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
  })

  it('초기 상태에서 min/max amount는 null', () => {
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchMinAmount).toBeNull()
    expect(result.current.searchMaxAmount).toBeNull()
  })

  it('URL에 min_amount가 있으면 searchMinAmount에 숫자로 파싱된다', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('min_amount', '5000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchMinAmount).toBe(5000)
  })

  it('URL에 max_amount가 있으면 searchMaxAmount에 숫자로 파싱된다', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('max_amount', '30000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchMaxAmount).toBe(30000)
  })

  it('min_amount/max_amount 모두 있으면 amountActive가 true', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('min_amount', '1000')
    mockSearchParams.set('max_amount', '50000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.amountActive).toBe(true)
  })

  it('min_amount만 있어도 amountActive가 true', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('min_amount', '1000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.amountActive).toBe(true)
  })

  it('min_amount/max_amount 모두 없으면 amountActive가 false', () => {
    mockSearchParams.set('search', '')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.amountActive).toBe(false)
  })

  it('amountActive이면 hasSearchFilters가 true', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('min_amount', '1000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.hasSearchFilters).toBe(true)
  })

  it('setAmountRange가 URL에 min_amount/max_amount를 설정한다', () => {
    mockSearchParams.set('search', '')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    act(() => {
      result.current.setAmountRange(5000, 50000)
    })
    expect(mockSetSearchParams).toHaveBeenCalled()
  })

  it('setAmountRange에 null 전달 시 해당 파라미터를 제거한다', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('min_amount', '5000')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    act(() => {
      result.current.setAmountRange(null, null)
    })
    expect(mockSetSearchParams).toHaveBeenCalled()
  })
})

describe('정렬', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
  })

  it('기본 정렬은 date_desc', () => {
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchSortBy).toBe('date')
    expect(result.current.searchSortOrder).toBe('desc')
  })

  it('URL에 sort_by=amount가 있으면 searchSortBy가 amount', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('sort_by', 'amount')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchSortBy).toBe('amount')
  })

  it('URL에 sort_order=asc가 있으면 searchSortOrder가 asc', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('sort_order', 'asc')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    expect(result.current.searchSortOrder).toBe('asc')
  })

  it('setSortOrder가 URL에 sort 파라미터를 설정한다', () => {
    mockSearchParams.set('search', '')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    act(() => {
      result.current.setSortOrder('amount', 'desc')
    })
    expect(mockSetSearchParams).toHaveBeenCalled()
  })

  it('기본값(date_desc)으로 setSortOrder 시 파라미터를 제거한다', () => {
    mockSearchParams.set('search', '')
    mockSearchParams.set('sort_by', 'amount')
    mockSearchParams.set('sort_order', 'asc')
    const { result } = renderHook(() =>
      useTransactionSearch({ activeHouseholdId: 1 })
    )
    act(() => {
      result.current.setSortOrder('date', 'desc')
    })
    expect(mockSetSearchParams).toHaveBeenCalled()
  })
})
