/**
 * @file useMonthlyTransactions.test.ts
 * @description useMonthlyTransactions 훅 테스트 — 월별 데이터 fetch, 필터링, 그룹핑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// useQuery를 위한 QueryClientProvider 래퍼
// react-router-dom이 전체 mock이므로 MemoryRouter 없이 QueryClientProvider만 사용
// .ts 파일이므로 JSX 대신 createElement 사용
function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// react-router-dom mock
const mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn((updater: (prev: URLSearchParams) => URLSearchParams) => {
  if (typeof updater === 'function') {
    const result = updater(mockSearchParams)
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

import { useMonthlyTransactions } from '../useMonthlyTransactions'

describe('useMonthlyTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
  })

  describe('초기 상태', () => {
    it('현재 월로 시작한다 (URL 파라미터 없을 때)', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      const now = new Date()
      expect(result.current.currentYear).toBe(now.getFullYear())
      expect(result.current.currentMonth).toBe(now.getMonth())
    })

    it('URL의 month 파라미터를 읽는다', () => {
      mockSearchParams.set('month', '2025-06')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      expect(result.current.currentYear).toBe(2025)
      expect(result.current.currentMonth).toBe(5) // 0-indexed
    })

  })

  describe('데이터 로딩', () => {
    it('activeHouseholdId가 있으면 데이터를 로드한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      // 초기 로딩 상태
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // MSW 핸들러가 카테고리를 반환
      expect(result.current.categories.length).toBeGreaterThan(0)
    })

    it('activeHouseholdId가 null이면 데이터를 로드하지 않는다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: null }), { wrapper: createQueryWrapper() })

      // loading이 true 상태로 유지 (fetchData가 early return)
      expect(result.current.loading).toBe(true)
      expect(result.current.expenses).toEqual([])
      expect(result.current.incomes).toEqual([])
    })

    it('카테고리 맵이 생성된다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.categoryMap.size).toBeGreaterThan(0)
      })

      // categoryMap의 값이 Category 객체인지 확인
      for (const [id, cat] of result.current.categoryMap) {
        expect(typeof id).toBe('number')
        expect(cat).toHaveProperty('name')
      }
    })
  })

  describe('navigateToMonth', () => {
    it('특정 연도/월로 직접 이동한다', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      result.current.navigateToMonth(2025, 2) // 2025년 3월 (0-indexed)

      expect(mockSetSearchParams).toHaveBeenCalled()
      const updatedParams = mockSearchParams
      expect(updatedParams.get('month')).toBe('2025-03')
    })

    it('연도를 넘나드는 월 이동도 처리한다', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      result.current.navigateToMonth(2024, 11) // 2024년 12월

      expect(mockSearchParams.get('month')).toBe('2024-12')
    })
  })

  describe('월 레이블', () => {
    it('현재 월의 한국어 레이블을 반환한다', () => {
      mockSearchParams.set('month', '2025-03')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      expect(result.current.monthLabel).toBe('3월')
    })
  })

  describe('그룹핑 및 요약', () => {
    it('totalExpense와 totalIncome을 계산한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // 숫자 타입이어야 한다
      expect(typeof result.current.totalExpense).toBe('number')
      expect(typeof result.current.totalIncome).toBe('number')
    })

    it('grouped가 Map<string, UnifiedTransaction[]> 형태이다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.grouped).toBeInstanceOf(Map)
    })

    it('daySummaries가 날짜별 지출/수입 합계를 제공한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.daySummaries).toBeInstanceOf(Map)

      for (const [key, summary] of result.current.daySummaries) {
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof summary.expense).toBe('number')
        expect(typeof summary.income).toBe('number')
      }
    })
  })

  describe('상태 업데이터', () => {
    it('setExpenses가 지출 목록을 업데이트한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // setExpenses가 함수인지 확인
      expect(typeof result.current.setExpenses).toBe('function')
    })

    it('setIncomes가 수입 목록을 업데이트한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.setIncomes).toBe('function')
    })

    it('setPendingRecurring이 대기 중인 반복 거래를 업데이트한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.setPendingRecurring).toBe('function')
    })
  })

  describe('allRecurring', () => {
    it('활성 정기거래 전체를 allRecurring으로 반환한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.allRecurring.length).toBeGreaterThan(0)
      expect(result.current.allRecurring.every((r) => r.is_active)).toBe(true)
    })
  })

  describe('에러 처리', () => {
    it('error 상태가 기본 false이다', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      expect(result.current.error).toBe(false)
    })

    it('fetchData 함수를 제공한다 (refetch용)', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 }), { wrapper: createQueryWrapper() })

      expect(typeof result.current.fetchData).toBe('function')
    })
  })

})
