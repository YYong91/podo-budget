/**
 * @file handlers.ts
 * @description MSW API 모킹 핸들러
 * 각 API 엔드포인트에 대한 모의 응답을 정의한다.
 */

import { http, HttpResponse } from 'msw'
import {
  mockCategories,
  mockExpenses,
  mockIncomes,
  mockIncomeStats,
  mockMonthlyStats,
  mockInsights,
  mockRecurringTransactions,
  mockStats,
  mockComparison,
  mockAssets,
  mockAssetSummary,
  mockAssetSnapshots,
  mockAssetGoal,
  mockMonthlySavings,
  mockChatResponse,
  mockFeedbacks,
  mockDashboardStats,
  mockStructuredInsights,
  mockIncomeComparison,
  mockStocks,
  mockPaymentMethods,
  mockPaymentMethodUsage,
} from './fixtures'

const BASE_URL = '/api'

/**
 * MSW 요청 핸들러 배열
 * 각 API 엔드포인트에 대한 모의 응답을 정의
 */
export const handlers = [
  // ==================== 지출 API ====================

  /**
   * GET /api/expenses - 지출 목록 조회
   */
  http.get(`${BASE_URL}/expenses`, ({ request }) => {
    const url = new URL(request.url)
    const skip = Number(url.searchParams.get('skip')) || 0
    const limit = Number(url.searchParams.get('limit')) || 20
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const categoryId = url.searchParams.get('category_id')

    const query = url.searchParams.get('query')

    let filtered = [...mockExpenses]

    // 검색어 필터링
    if (query) {
      filtered = filtered.filter((e) =>
        e.description.toLowerCase().includes(query.toLowerCase())
      )
    }

    // 필터링 적용
    if (startDate) {
      filtered = filtered.filter((e) => e.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter((e) => e.date <= endDate)
    }
    if (categoryId) {
      filtered = filtered.filter((e) => e.category_id === Number(categoryId))
    }

    // 페이지네이션 적용
    const paginated = filtered.slice(skip, skip + limit)

    return HttpResponse.json(paginated)
  }),

  /**
   * GET /api/expenses/stats/comparison - 기간 비교
   */
  http.get(`${BASE_URL}/expenses/stats/comparison`, () => {
    return HttpResponse.json(mockComparison)
  }),

  /**
   * GET /api/expenses/stats - 기간별 통계
   */
  http.get(`${BASE_URL}/expenses/stats`, () => {
    return HttpResponse.json(mockStats)
  }),

  /**
   * GET /api/expenses/search/summary - 지출 검색 합계
   */
  http.get(`${BASE_URL}/expenses/search/summary`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const filtered = query
      ? mockExpenses.filter((e) => e.description.toLowerCase().includes(query.toLowerCase()))
      : mockExpenses
    return HttpResponse.json({
      total_count: filtered.length,
      total_amount: filtered.reduce((sum, e) => sum + e.amount, 0),
    })
  }),

  /**
   * GET /api/expenses/:id - 단일 지출 조회
   */
  http.get(`${BASE_URL}/expenses/:id`, ({ params }) => {
    const expense = mockExpenses.find((e) => e.id === Number(params.id))
    if (!expense) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json(expense)
  }),

  /**
   * POST /api/expenses - 지출 생성
   */
  http.post(`${BASE_URL}/expenses`, async ({ request }) => {
    const body = await request.json() as Partial<typeof mockExpenses[0]>
    const newExpense = {
      id: Math.max(...mockExpenses.map((e) => e.id)) + 1,
      amount: body.amount ?? 0,
      description: body.description ?? '',
      category_id: body.category_id ?? null,
      raw_input: body.raw_input ?? null,
      date: body.date ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newExpense, { status: 201 })
  }),

  /**
   * PUT /api/expenses/:id - 지출 수정
   */
  http.put(`${BASE_URL}/expenses/:id`, async ({ params, request }) => {
    const expense = mockExpenses.find((e) => e.id === Number(params.id))
    if (!expense) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    const body = await request.json() as Partial<typeof mockExpenses[0]>
    const updated = {
      ...expense,
      ...body,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(updated)
  }),

  /**
   * DELETE /api/expenses/:id - 지출 삭제
   */
  http.delete(`${BASE_URL}/expenses/:id`, ({ params }) => {
    const expense = mockExpenses.find((e) => e.id === Number(params.id))
    if (!expense) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json(null, { status: 204 })
  }),

  /**
   * POST /api/expenses/ocr - OCR 이미지 파싱
   */
  http.post(`${BASE_URL}/expenses/ocr`, () => {
    return HttpResponse.json({
      parsed_expenses: [
        { amount: 4500, description: '아메리카노', category: '식비', date: '2026-03-19', memo: '', type: 'expense' },
      ],
    })
  }),

  /**
   * GET /api/expenses/stats/monthly - 월별 통계
   */
  http.get(`${BASE_URL}/expenses/stats/monthly`, ({ request }) => {
    const url = new URL(request.url)
    const month = url.searchParams.get('month')

    // 빈 통계 반환 (특정 month를 체크하고 싶으면 여기서 처리)
    if (month === '2024-02') {
      return HttpResponse.json({
        month: '2024-02',
        total: 0,
        by_category: [],
        daily_trend: [],
      })
    }

    return HttpResponse.json(mockMonthlyStats)
  }),

  // ==================== 수입 API ====================

  http.get(`${BASE_URL}/income`, ({ request }) => {
    const url = new URL(request.url)
    const skip = Number(url.searchParams.get('skip')) || 0
    const limit = Number(url.searchParams.get('limit')) || 20
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    const query = url.searchParams.get('query')

    let filtered = [...mockIncomes]
    if (query) {
      filtered = filtered.filter((i) =>
        i.description.toLowerCase().includes(query.toLowerCase())
      )
    }
    if (startDate) filtered = filtered.filter((i) => i.date >= startDate)
    if (endDate) filtered = filtered.filter((i) => i.date <= endDate)

    const paginated = filtered.slice(skip, skip + limit)
    return HttpResponse.json(paginated)
  }),

  http.get(`${BASE_URL}/income/stats/comparison`, () => {
    return HttpResponse.json(mockIncomeComparison)
  }),

  http.get(`${BASE_URL}/income/stats`, () => {
    return HttpResponse.json(mockIncomeStats)
  }),

  /**
   * GET /api/income/search/summary - 수입 검색 합계
   */
  http.get(`${BASE_URL}/income/search/summary`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    const filtered = query
      ? mockIncomes.filter((i) => i.description.toLowerCase().includes(query.toLowerCase()))
      : mockIncomes
    return HttpResponse.json({
      total_count: filtered.length,
      total_amount: filtered.reduce((sum, i) => sum + i.amount, 0),
    })
  }),

  http.get(`${BASE_URL}/income/:id`, ({ params }) => {
    const income = mockIncomes.find((i) => i.id === Number(params.id))
    if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(income)
  }),

  http.post(`${BASE_URL}/income`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockIncomes)[0]>
    const newIncome = {
      id: Math.max(...mockIncomes.map((i) => i.id)) + 1,
      amount: body.amount ?? 0,
      description: body.description ?? '',
      category_id: body.category_id ?? null,
      raw_input: body.raw_input ?? null,
      household_id: body.household_id ?? null,
      user_id: 1,
      date: body.date ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newIncome, { status: 201 })
  }),

  http.put(`${BASE_URL}/income/:id`, async ({ params, request }) => {
    const income = mockIncomes.find((i) => i.id === Number(params.id))
    if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as Partial<(typeof mockIncomes)[0]>
    return HttpResponse.json({ ...income, ...body, updated_at: new Date().toISOString() })
  }),

  http.delete(`${BASE_URL}/income/:id`, ({ params }) => {
    const income = mockIncomes.find((i) => i.id === Number(params.id))
    if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(null, { status: 204 })
  }),

  // ==================== 정기 거래 API ====================

  http.get(`${BASE_URL}/recurring`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    let filtered = mockRecurringTransactions.filter((r) => r.is_active)
    if (type) filtered = filtered.filter((r) => r.type === type)
    return HttpResponse.json(filtered)
  }),

  http.get(`${BASE_URL}/recurring/pending`, () => {
    return HttpResponse.json(mockRecurringTransactions.filter((r) => r.is_active))
  }),

  http.get(`${BASE_URL}/recurring/:id`, ({ params }) => {
    const item = mockRecurringTransactions.find((r) => r.id === Number(params.id))
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(item)
  }),

  http.post(`${BASE_URL}/recurring`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const newItem = {
      id: 99,
      user_id: 1,
      household_id: null,
      type: body.type ?? 'expense',
      amount: body.amount ?? 0,
      description: body.description ?? '',
      category_id: null,
      frequency: body.frequency ?? 'monthly',
      interval: body.interval ?? null,
      day_of_month: body.day_of_month ?? null,
      day_of_week: body.day_of_week ?? null,
      month_of_year: body.month_of_year ?? null,
      start_date: body.start_date ?? '2026-02-16',
      end_date: null,
      next_due_date: '2026-03-25',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newItem, { status: 201 })
  }),

  http.put(`${BASE_URL}/recurring/:id`, async ({ params, request }) => {
    const item = mockRecurringTransactions.find((r) => r.id === Number(params.id))
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...item, ...body, updated_at: new Date().toISOString() })
  }),

  http.delete(`${BASE_URL}/recurring/:id`, ({ params }) => {
    const item = mockRecurringTransactions.find((r) => r.id === Number(params.id))
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(null, { status: 204 })
  }),

  http.post(`${BASE_URL}/recurring/:id/execute`, ({ params }) => {
    const item = mockRecurringTransactions.find((r) => r.id === Number(params.id))
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      message: `${item.description} ${item.amount.toLocaleString()}원이 ${item.type === 'expense' ? '지출' : '수입'}으로 등록되었습니다`,
      created_id: 100,
      type: item.type,
      next_due_date: '2026-03-25',
    }, { status: 201 })
  }),

  http.post(`${BASE_URL}/recurring/:id/skip`, ({ params }) => {
    const item = mockRecurringTransactions.find((r) => r.id === Number(params.id))
    if (!item) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ next_due_date: '2026-03-25' })
  }),

  // ==================== 카테고리 API ====================

  /**
   * GET /api/categories - 카테고리 목록 조회
   */
  http.get(`${BASE_URL}/categories`, () => {
    return HttpResponse.json(mockCategories)
  }),

  /**
   * POST /api/categories - 카테고리 생성
   */
  http.post(`${BASE_URL}/categories`, async ({ request }) => {
    const body = await request.json() as { name: string; description?: string; emoji?: string }
    const newCategory = {
      id: Math.max(...mockCategories.map((c) => c.id)) + 1,
      name: body.name,
      description: body.description ?? null,
      emoji: body.emoji ?? '📌',
      is_system: false,
      created_at: new Date().toISOString(),
    }
    return HttpResponse.json(newCategory, { status: 201 })
  }),

  /**
   * PUT /api/categories/:id - 카테고리 수정
   */
  http.put(`${BASE_URL}/categories/:id`, async ({ params, request }) => {
    const category = mockCategories.find((c) => c.id === Number(params.id))
    if (!category) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    const body = await request.json() as { name?: string; description?: string; emoji?: string }
    const updated = {
      ...category,
      ...body,
      description: body.description ?? category.description,
      is_system: category.is_system,
    }
    return HttpResponse.json(updated)
  }),

  /**
   * DELETE /api/categories/:id - 카테고리 삭제
   */
  http.delete(`${BASE_URL}/categories/:id`, ({ params }) => {
    const category = mockCategories.find((c) => c.id === Number(params.id))
    if (!category) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json(null, { status: 204 })
  }),

  // ==================== 예산 API ====================

  /**
   * GET /api/budgets - 예산 목록 조회
   */
  http.get(`${BASE_URL}/budgets`, () => {
    return HttpResponse.json([])
  }),

  /**
   * GET /api/budgets/total-budget - 월 총 예산 조회
   */
  http.get(`${BASE_URL}/budgets/total-budget`, () => {
    return HttpResponse.json({ total_monthly_budget: null })
  }),

  /**
   * GET /api/budgets/monthly-stats - 월별 예산 대비 지출 통계
   */
  http.get(`${BASE_URL}/budgets/monthly-stats`, () => {
    return HttpResponse.json({
      month: '2026-03',
      total_budget: 500000,
      total_spent: 320000,
      categories: [
        {
          category_name: '식비',
          budget_amount: 300000,
          spent_amount: 220000,
          remaining_amount: 80000,
          usage_percentage: 73.3,
          is_exceeded: false,
        },
        {
          category_name: '교통비',
          budget_amount: 200000,
          spent_amount: 100000,
          remaining_amount: 100000,
          usage_percentage: 50.0,
          is_exceeded: false,
        },
      ],
    })
  }),

  // ==================== 자연어 채팅 API ====================

  http.post(`${BASE_URL}/chat`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    if (body.preview) {
      return HttpResponse.json({
        ...mockChatResponse,
        expenses_created: null,
        parsed_items: [
          { amount: 8000, category: '식비', description: '김치찌개', date: '2026-03-14', memo: '' },
        ],
        parsed_expenses: [
          { amount: 8000, category: '식비', description: '김치찌개', date: '2026-03-14', memo: '' },
        ],
      })
    }
    return HttpResponse.json(mockChatResponse)
  }),

  // ==================== 종목 검색 API ====================

  /**
   * GET /api/stocks/search - 종목 검색 (BE stocks 테이블)
   */
  http.get(`${BASE_URL}/stocks/search`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const results = mockStocks.filter(s => s.name.includes(q) || s.ticker.includes(q)).slice(0, 20)
    return HttpResponse.json(results)
  }),

  // ==================== 자산 API ====================

  http.get(`${BASE_URL}/assets`, () => {
    return HttpResponse.json(mockAssets)
  }),

  http.get(`${BASE_URL}/assets/summary`, () => {
    return HttpResponse.json(mockAssetSummary)
  }),

  http.get(`${BASE_URL}/assets/snapshots`, () => {
    return HttpResponse.json(mockAssetSnapshots)
  }),

  http.get(`${BASE_URL}/assets/search`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const results = mockAssets.filter((a) => a.name.includes(q)).map((a) => ({
      name: a.name,
      ticker: a.ticker,
      type: a.type,
      market: 'KR',
    }))
    return HttpResponse.json(results)
  }),

  http.get(`${BASE_URL}/assets/goal`, () => {
    return HttpResponse.json(mockAssetGoal)
  }),

  http.post(`${BASE_URL}/assets/goal`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      ...mockAssetGoal,
      target_net_worth: body.target_net_worth ?? mockAssetGoal.target_net_worth,
      target_date: body.target_date ?? mockAssetGoal.target_date,
    }, { status: 201 })
  }),

  http.delete(`${BASE_URL}/assets/goal`, () => {
    return HttpResponse.json(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/assets/monthly-savings`, () => {
    return HttpResponse.json(mockMonthlySavings)
  }),

  http.post(`${BASE_URL}/assets/parse`, async ({ request }) => {
    const body = (await request.json()) as { text: string }
    return HttpResponse.json({
      items: [{ name: body.text, type: 'deposit', purchase_price: 1000000, current_price: 1000000 }],
    })
  }),

  http.get(`${BASE_URL}/assets/:id`, ({ params }) => {
    const asset = mockAssets.find((a) => a.id === Number(params.id))
    if (!asset) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(asset)
  }),

  http.post(`${BASE_URL}/assets`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 99,
      ...body,
      user_id: 1,
      household_id: null,
      account_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.put(`${BASE_URL}/assets/:id`, async ({ params, request }) => {
    const asset = mockAssets.find((a) => a.id === Number(params.id))
    if (!asset) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...asset, ...body, updated_at: new Date().toISOString() })
  }),

  http.delete(`${BASE_URL}/assets/:id`, ({ params }) => {
    const asset = mockAssets.find((a) => a.id === Number(params.id))
    if (!asset) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(null, { status: 204 })
  }),

  // ==================== 결제수단 API ====================

  /**
   * GET /api/payment-methods/stats/monthly - 결제수단별 월 사용액 (구체적 경로 먼저)
   */
  http.get(`${BASE_URL}/payment-methods/stats/monthly`, () => {
    return HttpResponse.json(mockPaymentMethodUsage)
  }),

  /**
   * GET /api/payment-methods - 결제수단 목록 조회
   */
  http.get(`${BASE_URL}/payment-methods`, () => {
    return HttpResponse.json(mockPaymentMethods)
  }),

  /**
   * POST /api/payment-methods - 결제수단 생성
   */
  http.post(`${BASE_URL}/payment-methods`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const newMethod = {
      id: Math.max(...mockPaymentMethods.map((m) => m.id)) + 1,
      household_id: 1,
      created_by: 1,
      name: body.name ?? '',
      type: body.type ?? 'credit_card',
      monthly_target: body.monthly_target ?? null,
      is_default: body.is_default ?? false,
      is_system: false,
      is_active: true,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newMethod, { status: 201 })
  }),

  /**
   * PUT /api/payment-methods/reorder - 결제수단 순서 변경
   */
  http.put(`${BASE_URL}/payment-methods/reorder`, async ({ request }) => {
    const body = (await request.json()) as { ids: number[] }
    const reordered = body.ids.map((id, index) => {
      const method = mockPaymentMethods.find((m) => m.id === id)
      return method ? { ...method, display_order: index } : null
    }).filter(Boolean)
    return HttpResponse.json(reordered)
  }),

  /**
   * PUT /api/payment-methods/:id - 결제수단 수정
   */
  http.put(`${BASE_URL}/payment-methods/:id`, async ({ params, request }) => {
    const method = mockPaymentMethods.find((m) => m.id === Number(params.id))
    if (!method) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...method, ...body, updated_at: new Date().toISOString() })
  }),

  /**
   * DELETE /api/payment-methods/:id - 결제수단 삭제 (soft delete)
   */
  http.delete(`${BASE_URL}/payment-methods/:id`, ({ params }) => {
    const method = mockPaymentMethods.find((m) => m.id === Number(params.id))
    if (!method) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(null, { status: 204 })
  }),

  // ==================== 인사이트 API ====================

  /**
   * POST /api/insights/generate - 인사이트 생성
   */
  http.post(`${BASE_URL}/insights/generate`, ({ request }) => {
    const url = new URL(request.url)
    const month = url.searchParams.get('month')

    return HttpResponse.json({
      ...mockInsights,
      month: month || mockInsights.month,
    })
  }),

  /**
   * POST /api/insights/generate-comprehensive - 종합 인사이트 생성
   */
  http.post(`${BASE_URL}/insights/generate-comprehensive`, () => {
    return HttpResponse.json({
      month: '2026-03',
      insights: mockStructuredInsights,
    })
  }),

  // ==================== 피드백 API ====================

  http.post(`${BASE_URL}/feedback`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 99,
      user_id: 1,
      type: body.type ?? 'feature',
      title: body.title ?? '',
      content: body.content ?? '',
      status: 'new',
      source: body.source ?? 'web',
      username: 'testuser',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get(`${BASE_URL}/feedback/mine`, () => {
    return HttpResponse.json(mockFeedbacks)
  }),

  http.get(`${BASE_URL}/feedback`, () => {
    return HttpResponse.json(mockFeedbacks)
  }),

  http.patch(`${BASE_URL}/feedback/:id`, async ({ params, request }) => {
    const fb = mockFeedbacks.find((f) => f.id === Number(params.id))
    if (!fb) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const body = (await request.json()) as { status: string }
    return HttpResponse.json({ ...fb, status: body.status, updated_at: new Date().toISOString() })
  }),

  // ==================== 관리자 API ====================

  http.get(`${BASE_URL}/admin/stats/dashboard`, () => {
    return HttpResponse.json(mockDashboardStats)
  }),

  http.get(`${BASE_URL}/admin/users`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page')) || 1
    const pageSize = Number(url.searchParams.get('page_size')) || 20
    return HttpResponse.json({
      users: [
        { id: 1, username: 'testuser', email: 'test@example.com', is_active: true, created_at: '2026-01-01T00:00:00Z', expense_count: 100, income_count: 50 },
      ],
      total: 1,
      page,
      page_size: pageSize,
    })
  }),

  http.get(`${BASE_URL}/admin/users/:userId`, ({ params }) => {
    return HttpResponse.json({
      id: Number(params.userId),
      username: 'testuser',
      email: 'test@example.com',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      expense_count: 100,
      income_count: 50,
    })
  }),

  http.patch(`${BASE_URL}/admin/users/:userId`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: Number(params.userId),
      username: 'testuser',
      email: 'test@example.com',
      is_active: body.is_active ?? true,
      created_at: '2026-01-01T00:00:00Z',
      expense_count: 100,
      income_count: 50,
    })
  }),

  // ==================== 예산 일괄 수정 API ====================

  /**
   * PUT /api/budgets/bulk - 예산 일괄 수정
   */
  http.put(`${BASE_URL}/budgets/bulk`, async ({ request }) => {
    const body = (await request.json()) as Array<{ category_id: number; amount: number }>
    const budgets = body.map((b, i) => ({
      id: i + 1,
      category_id: b.category_id,
      amount: b.amount,
      month: '2026-03',
      household_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    return HttpResponse.json(budgets)
  }),

  // ==================== 초대 수락/거절 API ====================

  /**
   * POST /api/invitations/:token/accept - 초대 수락
   */
  http.post(`${BASE_URL}/invitations/:token/accept`, ({ params }) => {
    return HttpResponse.json({
      household_id: 1,
      household_name: '테스트 가구',
      token: params.token,
    })
  }),

  /**
   * POST /api/invitations/:token/reject - 초대 거절
   */
  http.post(`${BASE_URL}/invitations/:token/reject`, () => {
    return HttpResponse.json({ message: '초대를 거절했습니다' })
  }),

  // ==================== 계좌 API ====================

  /**
   * POST /api/accounts - 계좌 생성
   */
  http.post(`${BASE_URL}/accounts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 99,
      name: body.name ?? '',
      type: body.type ?? 'brokerage',
      household_id: 1,
      user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  /**
   * GET /api/accounts - 계좌 목록 조회
   */
  http.get(`${BASE_URL}/accounts`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: '키움증권',
        type: 'brokerage',
        household_id: 1,
        user_id: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])
  }),

  // ==================== 가구 멤버 관리 API ====================

  /**
   * PATCH /api/households/:id/members/:userId/role - 멤버 역할 변경
   */
  http.patch(`${BASE_URL}/households/:id/members/:userId/role`, async ({ params, request }) => {
    const body = (await request.json()) as { role: string }
    return HttpResponse.json({
      user_id: Number(params.userId),
      household_id: Number(params.id),
      role: body.role,
    })
  }),

  /**
   * POST /api/households/:id/leave - 가구 나가기
   */
  http.post(`${BASE_URL}/households/:id/leave`, () => {
    return HttpResponse.json({ message: '가구에서 나갔습니다' })
  }),

  // ==================== 인증 연동 코드 API ====================

  /**
   * POST /api/auth/telegram-link-code - 텔레그램 연동 코드 발급
   */
  http.post(`${BASE_URL}/auth/telegram-link-code`, () => {
    return HttpResponse.json({
      code: 'TG-ABC123',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    })
  }),

  /**
   * POST /api/auth/kakao-link-code - 카카오 연동 코드 발급
   */
  http.post(`${BASE_URL}/auth/kakao-link-code`, () => {
    return HttpResponse.json({
      code: 'KK-XYZ789',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    })
  }),
]
