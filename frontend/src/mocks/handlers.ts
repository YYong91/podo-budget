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
  mockStats,
  mockComparison,
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

    let filtered = [...mockExpenses]

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

    let filtered = [...mockIncomes]
    if (startDate) filtered = filtered.filter((i) => i.date >= startDate)
    if (endDate) filtered = filtered.filter((i) => i.date <= endDate)

    const paginated = filtered.slice(skip, skip + limit)
    return HttpResponse.json(paginated)
  }),

  http.get(`${BASE_URL}/income/stats`, () => {
    return HttpResponse.json(mockIncomeStats)
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
    const body = await request.json() as { name: string; description?: string }
    const newCategory = {
      id: Math.max(...mockCategories.map((c) => c.id)) + 1,
      name: body.name,
      description: body.description ?? null,
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
    const body = await request.json() as { name?: string; description?: string }
    const updated = {
      ...category,
      ...body,
      description: body.description ?? category.description,
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
]
