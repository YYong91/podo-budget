/**
 * @file expenses.test.ts
 * @description 지출 API 단위 테스트
 * expenseApi의 모든 메서드를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { expenseApi } from '../expenses'
import { mockExpenses, mockMonthlyStats } from '../../mocks/fixtures'

describe('expenseApi', () => {
  describe('getAll', () => {
    it('모든 지출 목록을 조회한다', async () => {
      const response = await expenseApi.getAll()
      expect(response.data).toEqual(mockExpenses)
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('limit 파라미터를 전달하여 지출 목록을 조회한다', async () => {
      const response = await expenseApi.getAll({ limit: 2 })
      expect(response.data).toHaveLength(2)
    })

    it('skip 파라미터를 전달하여 페이지네이션을 처리한다', async () => {
      const response = await expenseApi.getAll({ skip: 1, limit: 2 })
      expect(response.data).toHaveLength(2)
      expect(response.data[0].id).toBe(mockExpenses[1].id)
    })

    it('category_id 필터로 특정 카테고리의 지출만 조회한다', async () => {
      const response = await expenseApi.getAll({ category_id: 1 })
      expect(response.data.every((e) => e.category_id === 1)).toBe(true)
    })

    it('start_date 필터로 특정 날짜 이후의 지출만 조회한다', async () => {
      const response = await expenseApi.getAll({ start_date: '2024-01-15T00:00:00Z' })
      expect(response.data.every((e) => e.date >= '2024-01-15T00:00:00Z')).toBe(true)
    })

    it('end_date 필터로 특정 날짜 이전의 지출만 조회한다', async () => {
      const response = await expenseApi.getAll({ end_date: '2024-01-14T23:59:59Z' })
      expect(response.data.every((e) => e.date <= '2024-01-14T23:59:59Z')).toBe(true)
    })
  })

  describe('getById', () => {
    it('ID로 단일 지출을 조회한다', async () => {
      const response = await expenseApi.getById(1)
      expect(response.data).toEqual(mockExpenses[0])
      expect(response.data.id).toBe(1)
    })

    it('존재하지 않는 ID로 조회 시 404 에러를 반환한다', async () => {
      await expect(expenseApi.getById(999)).rejects.toThrow()
    })
  })

  describe('create', () => {
    it('새로운 지출을 생성한다', async () => {
      const newExpense = {
        amount: 15000,
        description: '커피',
        category_id: 1,
        date: '2024-01-16T10:00:00Z',
      }
      const response = await expenseApi.create(newExpense)

      expect(response.data).toMatchObject({
        amount: 15000,
        description: '커피',
        category_id: 1,
      })
      expect(response.data.id).toBeGreaterThan(0)
    })
  })

  describe('update', () => {
    it('기존 지출을 수정한다', async () => {
      const updates = {
        amount: 12000,
        description: '김치찌개 수정',
      }
      const response = await expenseApi.update(1, updates)

      expect(response.data.amount).toBe(12000)
      expect(response.data.description).toBe('김치찌개 수정')
    })

    it('존재하지 않는 ID로 수정 시 404 에러를 반환한다', async () => {
      await expect(expenseApi.update(999, { amount: 1000 })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('지출을 삭제한다', async () => {
      const response = await expenseApi.delete(1)
      expect(response.status).toBe(204)
    })

    it('존재하지 않는 ID로 삭제 시 404 에러를 반환한다', async () => {
      await expect(expenseApi.delete(999)).rejects.toThrow()
    })
  })

  describe('getMonthlyStats', () => {
    it('특정 월의 통계를 조회한다', async () => {
      const response = await expenseApi.getMonthlyStats('2024-01')
      expect(response.data).toEqual(mockMonthlyStats)
      expect(response.data.month).toBe('2024-01')
      expect(response.data.total).toBeGreaterThan(0)
      expect(Array.isArray(response.data.by_category)).toBe(true)
      expect(Array.isArray(response.data.daily_trend)).toBe(true)
    })

    it('데이터가 없는 월의 통계를 조회하면 빈 데이터를 반환한다', async () => {
      const response = await expenseApi.getMonthlyStats('2024-02')
      expect(response.data.total).toBe(0)
      expect(response.data.by_category).toHaveLength(0)
      expect(response.data.daily_trend).toHaveLength(0)
    })
  })
})
