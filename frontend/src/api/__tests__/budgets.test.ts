/**
 * @file budgets.test.ts
 * @description 예산 API 단위 테스트
 * budgetApi의 모든 메서드를 MSW로 테스트한다.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import budgetApi from '../budgets'

const BASE_URL = '/api'

// 테스트용 예산 데이터
const mockBudgets = [
  {
    id: 1,
    category_id: 1,
    amount: 300000,
    period: 'monthly' as const,
    start_date: '2024-01-01',
    end_date: null,
    alert_threshold: 80,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    category_id: 2,
    amount: 100000,
    period: 'monthly' as const,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    alert_threshold: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

// 테스트용 예산 알림 데이터
const mockAlerts = [
  {
    budget_id: 1,
    category_id: 1,
    category_name: '식비',
    budget_amount: 300000,
    spent_amount: 250000,
    remaining_amount: 50000,
    usage_percentage: 83.3,
    is_exceeded: false,
    is_warning: true,
  },
]

// 핸들러 정의 — alerts를 먼저 배치하여 /budgets/alerts가 /budgets/:id보다 우선 매칭되도록 함
const budgetHandlers = [
  http.get(`${BASE_URL}/budgets/alerts`, () =>
    HttpResponse.json(mockAlerts)
  ),
  http.get(`${BASE_URL}/budgets/`, () =>
    HttpResponse.json(mockBudgets)
  ),
  http.post(`${BASE_URL}/budgets/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const newBudget = {
      id: 3,
      ...body,
      end_date: body.end_date ?? null,
      alert_threshold: body.alert_threshold ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newBudget, { status: 201 })
  }),
  http.put(`${BASE_URL}/budgets/:id`, async ({ params, request }) => {
    const budget = mockBudgets.find((b) => b.id === Number(params.id))
    if (!budget) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    const body = await request.json() as Record<string, unknown>
    const updated = { ...budget, ...body, updated_at: new Date().toISOString() }
    return HttpResponse.json(updated)
  }),
  http.delete(`${BASE_URL}/budgets/:id`, ({ params }) => {
    const budget = mockBudgets.find((b) => b.id === Number(params.id))
    if (!budget) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),
]

describe('budgetApi', () => {
  beforeEach(() => {
    server.use(...budgetHandlers)
  })

  describe('getBudgets', () => {
    it('GET /api/budgets/를 호출하여 예산 목록을 반환한다', async () => {
      const response = await budgetApi.getBudgets()

      expect(response.data).toEqual(mockBudgets)
      expect(response.data).toHaveLength(2)
    })
  })

  describe('createBudget', () => {
    it('POST /api/budgets/를 호출하여 예산을 생성한다', async () => {
      const newBudget = {
        category_id: 3,
        amount: 200000,
        period: 'monthly' as const,
        start_date: '2024-02-01',
      }
      const response = await budgetApi.createBudget(newBudget)

      expect(response.data.id).toBe(3)
      expect(response.data.category_id).toBe(3)
      expect(response.data.amount).toBe(200000)
      expect(response.status).toBe(201)
    })
  })

  describe('updateBudget', () => {
    it('PUT /api/budgets/:id를 호출하여 예산을 수정한다', async () => {
      const updates = { amount: 350000 }
      const response = await budgetApi.updateBudget(1, updates)

      expect(response.data.id).toBe(1)
      expect(response.data.amount).toBe(350000)
    })

    it('존재하지 않는 ID로 수정 시 404 에러를 반환한다', async () => {
      await expect(budgetApi.updateBudget(999, { amount: 1000 })).rejects.toThrow()
    })
  })

  describe('deleteBudget', () => {
    it('DELETE /api/budgets/:id를 호출하여 예산을 삭제한다', async () => {
      const response = await budgetApi.deleteBudget(1)

      expect(response.status).toBe(204)
    })

    it('존재하지 않는 ID로 삭제 시 404 에러를 반환한다', async () => {
      await expect(budgetApi.deleteBudget(999)).rejects.toThrow()
    })
  })

  describe('getBudgetAlerts', () => {
    it('GET /api/budgets/alerts를 호출하여 예산 알림을 반환한다', async () => {
      const response = await budgetApi.getBudgetAlerts()

      expect(response.data).toEqual(mockAlerts)
      expect(response.data).toHaveLength(1)
      expect(response.data[0].is_warning).toBe(true)
      expect(response.data[0].is_exceeded).toBe(false)
    })
  })
})
