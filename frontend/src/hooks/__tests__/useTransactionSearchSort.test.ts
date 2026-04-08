/**
 * @file useTransactionSearchSort.test.ts
 * @description 정렬 결과 검증 테스트 — API 모킹 후 실제 정렬 순서 확인
 * (vi.mock 호이스팅 충돌 방지를 위해 메인 테스트 파일과 분리)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── API 모킹 (vi.hoisted로 호이스팅 순서 보장) ──

const mockExpenseApi = vi.hoisted(() => ({
  getAll: vi.fn(),
  searchSummary: vi.fn(),
}))
const mockIncomeApi = vi.hoisted(() => ({
  getAll: vi.fn(),
  searchSummary: vi.fn(),
}))

vi.mock('../../api/expenses', () => ({ expenseApi: mockExpenseApi }))
vi.mock('../../api/income', () => ({ incomeApi: mockIncomeApi }))

// ── URL 파라미터 모킹 ──

const mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()

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
  useToast: () => ({ addToast: vi.fn() }),
}))

import { useTransactionSearch } from '../useTransactionSearch'

// 테스트용 거래 픽스처
const makeExpense = (id: number, amount: number, date: string) => ({
  id,
  amount,
  date,
  description: `거래${id}`,
  category_id: null,
  user_id: null,
  created_at: '',
  exclude_from_stats: false,
  recurring_transaction_id: null,
  raw_input: null,
})

describe('정렬 결과 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.forEach((_v, k) => mockSearchParams.delete(k))
    mockIncomeApi.getAll.mockResolvedValue({ data: [] })
    mockExpenseApi.searchSummary.mockResolvedValue({ data: { total_count: 0, total_amount: 0 } })
    mockIncomeApi.searchSummary.mockResolvedValue({ data: { total_count: 0, total_amount: 0 } })
  })

  it('amount_desc 정렬 시 금액 큰 것이 앞에 온다', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(1, 5000, '2026-02-01'),
        makeExpense(2, 30000, '2026-02-02'),
        makeExpense(3, 8000, '2026-02-03'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_by', 'amount')
    mockSearchParams.set('sort_order', 'desc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(3))

    expect(result.current.searchResults.map(r => r.amount)).toEqual([30000, 8000, 5000])
  })

  it('amount_asc 정렬 시 금액 작은 것이 앞에 온다', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(1, 5000, '2026-02-01'),
        makeExpense(2, 30000, '2026-02-02'),
        makeExpense(3, 8000, '2026-02-03'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_by', 'amount')
    mockSearchParams.set('sort_order', 'asc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(3))

    expect(result.current.searchResults.map(r => r.amount)).toEqual([5000, 8000, 30000])
  })

  it('date_desc 정렬 시 최신 날짜가 앞에 온다', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(1, 5000, '2026-02-01'),
        makeExpense(3, 8000, '2026-02-03'),
        makeExpense(2, 30000, '2026-02-02'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_order', 'desc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(3))

    expect(result.current.searchResults.map(r => r.date)).toEqual([
      '2026-02-03',
      '2026-02-02',
      '2026-02-01',
    ])
  })

  it('date_asc 정렬 시 오래된 날짜가 앞에 온다', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(3, 8000, '2026-02-03'),
        makeExpense(1, 5000, '2026-02-01'),
        makeExpense(2, 30000, '2026-02-02'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_order', 'asc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(3))

    expect(result.current.searchResults.map(r => r.date)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
    ])
  })

  it('동일 날짜에서 date_desc 타이브레이커는 id 내림차순', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(2, 3000, '2026-02-01'),
        makeExpense(5, 8000, '2026-02-01'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_order', 'desc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(2))

    expect(result.current.searchResults[0].id).toBe(5)
    expect(result.current.searchResults[1].id).toBe(2)
  })

  it('동일 날짜에서 date_asc 타이브레이커는 id 오름차순', async () => {
    mockExpenseApi.getAll.mockResolvedValue({
      data: [
        makeExpense(5, 3000, '2026-02-01'),
        makeExpense(2, 8000, '2026-02-01'),
      ],
    })
    mockSearchParams.set('search', '테스트')
    mockSearchParams.set('sort_order', 'asc')

    const { result } = renderHook(() => useTransactionSearch({ activeHouseholdId: 1 }))
    await waitFor(() => expect(result.current.searchResults.length).toBe(2))

    expect(result.current.searchResults[0].id).toBe(2)
    expect(result.current.searchResults[1].id).toBe(5)
  })
})
