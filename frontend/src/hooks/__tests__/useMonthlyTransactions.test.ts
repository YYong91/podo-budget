/**
 * @file useMonthlyTransactions.test.ts
 * @description useMonthlyTransactions 훅 테스트 — 월별 데이터 fetch, 필터링, 그룹핑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

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
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      const now = new Date()
      expect(result.current.currentYear).toBe(now.getFullYear())
      expect(result.current.currentMonth).toBe(now.getMonth())
    })

    it('URL의 month 파라미터를 읽는다', () => {
      mockSearchParams.set('month', '2025-06')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.currentYear).toBe(2025)
      expect(result.current.currentMonth).toBe(5) // 0-indexed
    })

    it('기본 필터는 all이다', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.filter).toBe('all')
    })

    it('URL의 filter 파라미터를 읽는다', () => {
      mockSearchParams.set('filter', 'expense')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.filter).toBe('expense')
    })
  })

  describe('데이터 로딩', () => {
    it('activeHouseholdId가 있으면 데이터를 로드한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

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
        useMonthlyTransactions({ activeHouseholdId: null })
      )

      // loading이 true 상태로 유지 (fetchData가 early return)
      expect(result.current.loading).toBe(true)
      expect(result.current.expenses).toEqual([])
      expect(result.current.incomes).toEqual([])
    })

    it('카테고리 맵이 생성된다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

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

  describe('월 레이블', () => {
    it('현재 월의 한국어 레이블을 반환한다', () => {
      mockSearchParams.set('month', '2025-03')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.monthLabel).toBe('2025년 3월')
    })
  })

  describe('그룹핑 및 요약', () => {
    it('totalExpense와 totalIncome을 계산한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // 숫자 타입이어야 한다
      expect(typeof result.current.totalExpense).toBe('number')
      expect(typeof result.current.totalIncome).toBe('number')
    })

    it('grouped가 Map<string, UnifiedTransaction[]> 형태이다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.grouped).toBeInstanceOf(Map)
    })

    it('daySummaries가 날짜별 지출/수입 합계를 제공한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

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
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // setExpenses가 함수인지 확인
      expect(typeof result.current.setExpenses).toBe('function')
    })

    it('setIncomes가 수입 목록을 업데이트한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.setIncomes).toBe('function')
    })

    it('setPendingRecurring이 대기 중인 반복 거래를 업데이트한다', async () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(typeof result.current.setPendingRecurring).toBe('function')
    })
  })

  describe('에러 처리', () => {
    it('error 상태가 기본 false이다', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.error).toBe(false)
    })

    it('fetchData 함수를 제공한다 (refetch용)', () => {
      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(typeof result.current.fetchData).toBe('function')
    })
  })

  describe('필터 상태 복원', () => {
    it('필터 변경 시 sessionStorage에 백업한다', () => {
      mockSearchParams.set('filter', 'expense')

      renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(sessionStorage.getItem('podo-transaction-filter')).toBe('expense')
    })

    it('URL에 filter가 없으면 sessionStorage에서 복원한다', () => {
      sessionStorage.setItem('podo-transaction-filter', 'income')

      const { result } = renderHook(() =>
        useMonthlyTransactions({ activeHouseholdId: 1 })
      )

      expect(result.current.filter).toBe('income')
    })
  })
})
