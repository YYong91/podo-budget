/**
 * @file useNaturalInput.test.ts
 * @description useNaturalInput 훅 단위 테스트
 * 자연어 입력 → LLM 프리뷰 → 수정 → 저장 흐름을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'

// ── 모킹 ──

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

const mockAddToast = vi.fn()
vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: { activeHouseholdId: number }) => unknown) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}))

import { useNaturalInput } from '../useNaturalInput'
import type { Category } from '../../types'

// ── 테스트용 데이터 ──

const mockCategories: Category[] = [
  { id: 1, name: '식비', type: 'expense', description: null, sort_order: 1, is_savings: false, is_system: true, exclude_auto_payment: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: '교통', type: 'expense', description: null, sort_order: 2, is_savings: false, is_system: true, exclude_auto_payment: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: '급여', type: 'income', description: null, sort_order: 3, is_savings: false, is_system: true, exclude_auto_payment: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: '부업', type: 'both', description: null, sort_order: 4, is_savings: false, is_system: false, exclude_auto_payment: false, created_at: '2024-01-01T00:00:00Z' },
]

function setupCategoryHandler(categories: Category[] = mockCategories) {
  server.use(
    http.get('/api/categories', ({ request }) => {
      const url = new URL(request.url)
      const typeParam = url.searchParams.get('type')
      // 서버와 동일하게 type 파라미터로 필터링
      if (typeParam) {
        return HttpResponse.json(categories.filter((c) => c.type === typeParam || c.type === 'both'))
      }
      return HttpResponse.json(categories)
    })
  )
}

function setupChatHandler(parsedExpenses: unknown[] | null, message = '') {
  server.use(
    http.post('/api/chat', () =>
      HttpResponse.json({
        message,
        expenses_created: null,
        incomes_created: null,
        parsed_items: null,
        parsed_expenses: parsedExpenses,
        insights: null,
      })
    )
  )
}

describe('useNaturalInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupCategoryHandler()
  })

  // ── 초기 상태 ──

  describe('초기 상태', () => {
    it('expense 타입: 초기 상태가 올바르다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      expect(result.current.naturalInput).toBe('')
      expect(result.current.previewItems).toBeNull()
      expect(result.current.rawInput).toBe('')
      expect(result.current.loading).toBe(false)
      expect(result.current.showNewCategoryFor).toBeNull()
      expect(result.current.newCategoryName).toBe('')
      expect(result.current.creatingCategory).toBe(false)
    })

    it('expense 타입: expense 카테고리만 반환한다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      // expense는 categoryApi.getAll({ type: 'expense' })를 호출하므로
      // 서버에서 expense + both 타입만 반환 (서버측 필터링)
      expect(result.current.categories.every((c) => c.type === 'expense' || c.type === 'both')).toBe(true)
      // income 전용 카테고리는 포함되지 않아야 함
      expect(result.current.categories.find((c) => c.type === 'income')).toBeUndefined()
    })

    it('income 타입: income/both 카테고리만 반환한다', async () => {
      const { result } = renderHook(() => useNaturalInput('income'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      expect(result.current.categories.every((c) => c.type === 'income' || c.type === 'both')).toBe(true)
      expect(result.current.categories.map((c) => c.name)).toEqual(['급여', '부업'])
    })
  })

  // ── setNaturalInput ──

  describe('setNaturalInput', () => {
    it('자연어 입력값을 업데이트한다', () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      act(() => {
        result.current.setNaturalInput('오늘 점심 김치찌개 8000원')
      })

      expect(result.current.naturalInput).toBe('오늘 점심 김치찌개 8000원')
    })
  })

  // ── handlePreview ──

  describe('handlePreview (expense)', () => {
    it('빈 입력이면 에러 토스트를 표시한다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(mockAddToast).toHaveBeenCalledWith('error', '메시지를 입력해주세요')
    })

    it('LLM 파싱 성공 시 프리뷰 항목을 설정한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('expense'))

      // 카테고리 로드 대기
      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.setNaturalInput('김치찌개 8000원')
      })

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(result.current.previewItems).not.toBeNull()
      expect(result.current.previewItems).toHaveLength(1)
      expect(result.current.previewItems![0].amount).toBe(8000)
      expect(result.current.previewItems![0].category_id).toBe(1) // '식비' → id 1
      expect(result.current.rawInput).toBe('김치찌개 8000원')
    })

    it('파싱 결과가 없으면 안내 메시지를 표시한다', async () => {
      setupChatHandler([], '파싱 불가')

      const { result } = renderHook(() => useNaturalInput('expense'))

      act(() => {
        result.current.setNaturalInput('안녕하세요')
      })

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(mockAddToast).toHaveBeenCalledWith('info', '파싱 불가')
      expect(result.current.previewItems).toBeNull()
    })

    it('API 에러 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/chat', () => HttpResponse.error())
      )

      const { result } = renderHook(() => useNaturalInput('expense'))

      act(() => {
        result.current.setNaturalInput('김치찌개 8000원')
      })

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(mockAddToast).toHaveBeenCalledWith('error', '분석에 실패했어요')
    })
  })

  describe('handlePreview (income)', () => {
    it('income 항목만 프리뷰에 설정하고 expense 건수를 기록한다', async () => {
      server.use(
        http.post('/api/chat', () =>
          HttpResponse.json({
            message: '',
            expenses_created: null,
            incomes_created: null,
            parsed_items: null,
            parsed_expenses: [
              { amount: 3500000, description: '월급', category: '급여', date: '2026-03-25', memo: '', type: 'income' },
              { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
            ],
            insights: null,
          })
        )
      )

      const { result } = renderHook(() => useNaturalInput('income'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.setNaturalInput('월급 350만원, 점심 8000원')
      })

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(result.current.previewItems).toHaveLength(1)
      expect(result.current.previewItems![0].description).toBe('월급')
      expect(result.current.expenseCount).toBe(1)
    })

    it('모든 항목이 지출이면 안내 메시지를 표시한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('income'))

      act(() => {
        result.current.setNaturalInput('김치찌개 8000원')
      })

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(mockAddToast).toHaveBeenCalledWith('info', '지출로 분류되었습니다. 지출 입력을 이용해주세요')
    })
  })

  // ── updatePreviewItem ──

  describe('updatePreviewItem', () => {
    it('프리뷰 항목의 필드를 업데이트한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('테스트'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      act(() => {
        result.current.updatePreviewItem(0, 'amount', 10000)
      })

      expect(result.current.previewItems![0].amount).toBe(10000)
    })

    it('category_id 변경 시 category 이름도 동기화된다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('테스트'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      act(() => {
        result.current.updatePreviewItem(0, 'category_id', 2) // 교통
      })

      expect(result.current.previewItems![0].category_id).toBe(2)
      expect(result.current.previewItems![0].category).toBe('교통')
    })
  })

  // ── removePreviewItem ──

  describe('removePreviewItem', () => {
    it('프리뷰 항목을 삭제한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
        { amount: 3000, description: '버스', category: '교통', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('테스트'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      expect(result.current.previewItems).toHaveLength(2)

      act(() => {
        result.current.removePreviewItem(0)
      })

      expect(result.current.previewItems).toHaveLength(1)
      expect(result.current.previewItems![0].description).toBe('버스')
    })

    it('마지막 항목을 삭제하면 previewItems가 null이 된다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('테스트'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      act(() => {
        result.current.removePreviewItem(0)
      })

      expect(result.current.previewItems).toBeNull()
    })
  })

  // ── handleConfirmSave ──

  describe('handleConfirmSave (expense)', () => {
    it('프리뷰 항목을 저장하고 목록으로 이동한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      let createCalled = false
      server.use(
        http.post('/api/expenses', () => {
          createCalled = true
          return HttpResponse.json({ id: 1, amount: 8000 })
        })
      )

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('김치찌개 8000원'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      await act(async () => {
        await result.current.handleConfirmSave()
      })

      expect(createCalled).toBe(true)
      expect(mockAddToast).toHaveBeenCalledWith('success', '저장했어요')
      expect(result.current.previewItems).toBeNull()
      expect(result.current.naturalInput).toBe('')
    })

    it('income 타입 항목은 incomeApi로 저장한다 (expense 모드 혼합)', async () => {
      setupChatHandler([
        { amount: 3500000, description: '월급', category: '급여', date: '2026-03-25', memo: '', type: 'income' },
      ])

      let incomeCreateCalled = false
      server.use(
        http.post('/api/income', () => {
          incomeCreateCalled = true
          return HttpResponse.json({ id: 1, amount: 3500000 })
        })
      )

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('월급 350만원'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      await act(async () => {
        await result.current.handleConfirmSave()
      })

      expect(incomeCreateCalled).toBe(true)
    })

    it('previewItems가 없으면 아무 일도 하지 않는다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      await act(async () => {
        await result.current.handleConfirmSave()
      })

      expect(mockAddToast).not.toHaveBeenCalledWith('success', expect.any(String))
    })

    it('저장 실패 시 에러 토스트를 표시한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      server.use(
        http.post('/api/expenses', () =>
          HttpResponse.json({ detail: 'error' }, { status: 500 })
        )
      )

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('김치찌개 8000원'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      await act(async () => {
        await result.current.handleConfirmSave()
      })

      expect(mockAddToast).toHaveBeenCalledWith('error', '저장에 실패했어요')
    })
  })

  describe('handleConfirmSave (income)', () => {
    it('income 모드에서는 항상 incomeApi를 사용한다', async () => {
      server.use(
        http.post('/api/chat', () =>
          HttpResponse.json({
            message: '',
            expenses_created: null,
            incomes_created: null,
            parsed_items: null,
            parsed_expenses: [
              { amount: 3500000, description: '월급', category: '급여', date: '2026-03-25', memo: '', type: 'income' },
            ],
            insights: null,
          })
        )
      )

      let incomeCreateCalled = false
      server.use(
        http.post('/api/income', () => {
          incomeCreateCalled = true
          return HttpResponse.json({ id: 1, amount: 3500000 })
        })
      )

      const { result } = renderHook(() => useNaturalInput('income'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('월급 350만원'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      await act(async () => {
        await result.current.handleConfirmSave()
      })

      expect(incomeCreateCalled).toBe(true)
      expect(mockAddToast).toHaveBeenCalledWith('success', '저장했어요')
    })
  })

  // ── handleCreateCategory ──

  describe('handleCreateCategory', () => {
    it('새 카테고리를 생성하고 프리뷰 항목에 적용한다', async () => {
      setupChatHandler([
        { amount: 8000, description: '김치찌개', category: '식비', date: '2026-03-25', memo: '', type: 'expense' },
      ])

      const newCategory: Category = {
        id: 99,
        name: '외식',
        type: 'expense',
        description: null,
        sort_order: 99,
        is_savings: false,
        is_system: false,
        exclude_auto_payment: false,
        created_at: '2026-03-25T00:00:00Z',
      }

      server.use(
        http.post('/api/categories', () => HttpResponse.json(newCategory))
      )

      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => result.current.setNaturalInput('김치찌개 8000원'))

      await act(async () => {
        await result.current.handlePreview({ preventDefault: vi.fn() } as unknown as React.FormEvent)
      })

      // 새 카테고리 이름 설정
      act(() => {
        result.current.setNewCategoryName('외식')
        result.current.setShowNewCategoryFor(0)
      })

      await act(async () => {
        await result.current.handleCreateCategory(0)
      })

      expect(result.current.previewItems![0].category_id).toBe(99)
      expect(result.current.showNewCategoryFor).toBeNull()
      expect(result.current.newCategoryName).toBe('')
      expect(mockAddToast).toHaveBeenCalledWith('success', '카테고리를 추가했어요')
    })

    it('빈 이름이면 아무 일도 하지 않는다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      await act(async () => {
        await result.current.handleCreateCategory(0)
      })

      expect(mockAddToast).not.toHaveBeenCalledWith('success', expect.any(String))
    })
  })

  // ── setOcrPreviewItems ──

  describe('setOcrPreviewItems', () => {
    it('OCR 결과를 프리뷰 항목으로 설정한다', async () => {
      const { result } = renderHook(() => useNaturalInput('expense'))

      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.setOcrPreviewItems(
          [{ amount: 15000, description: '편의점', category: '식비', date: '2026-03-25', memo: '', type: 'expense' }],
          'receipt.jpg'
        )
      })

      expect(result.current.previewItems).toHaveLength(1)
      expect(result.current.previewItems![0].amount).toBe(15000)
      expect(result.current.previewItems![0].category_id).toBe(1)
      expect(result.current.rawInput).toBe('[OCR] receipt.jpg')
    })
  })
})
