/**
 * @file income.test.ts
 * @description 수입 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { incomeApi } from '../income'
import { mockIncomes, mockIncomeStats } from '../../mocks/fixtures'

describe('incomeApi', () => {
  describe('getAll', () => {
    it('모든 수입 목록을 조회한다', async () => {
      const response = await incomeApi.getAll()
      expect(response.data).toEqual(mockIncomes)
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('limit 파라미터를 전달하여 수입 목록을 조회한다', async () => {
      const response = await incomeApi.getAll({ limit: 1 })
      expect(response.data).toHaveLength(1)
    })

    it('skip 파라미터를 전달하여 페이지네이션을 처리한다', async () => {
      const response = await incomeApi.getAll({ skip: 1, limit: 1 })
      expect(response.data).toHaveLength(1)
      expect(response.data[0].id).toBe(mockIncomes[1].id)
    })

    it('start_date 필터로 특정 날짜 이후의 수입만 조회한다', async () => {
      const response = await incomeApi.getAll({ start_date: '2026-02-05T00:00:00Z' })
      expect(response.data.every((i) => i.date >= '2026-02-05T00:00:00Z')).toBe(true)
    })

    it('end_date 필터로 특정 날짜 이전의 수입만 조회한다', async () => {
      const response = await incomeApi.getAll({ end_date: '2026-02-05T00:00:00Z' })
      expect(response.data.every((i) => i.date <= '2026-02-05T00:00:00Z')).toBe(true)
    })
  })

  describe('getById', () => {
    it('ID로 단일 수입을 조회한다', async () => {
      const response = await incomeApi.getById(1)
      expect(response.data).toEqual(mockIncomes[0])
      expect(response.data.id).toBe(1)
    })

    it('존재하지 않는 ID로 조회 시 에러를 반환한다', async () => {
      await expect(incomeApi.getById(999)).rejects.toThrow()
    })
  })

  describe('create', () => {
    it('새로운 수입을 생성한다', async () => {
      const newIncome = {
        amount: 2000000,
        description: '보너스',
        date: '2026-03-01T09:00:00Z',
      }
      const response = await incomeApi.create(newIncome)
      expect(response.data).toMatchObject({
        amount: 2000000,
        description: '보너스',
      })
      expect(response.data.id).toBeGreaterThan(0)
    })
  })

  describe('update', () => {
    it('기존 수입을 수정한다', async () => {
      const updates = { amount: 4000000, description: '월급 수정' }
      const response = await incomeApi.update(1, updates)
      expect(response.data.amount).toBe(4000000)
      expect(response.data.description).toBe('월급 수정')
    })

    it('존재하지 않는 ID로 수정 시 에러를 반환한다', async () => {
      await expect(incomeApi.update(999, { amount: 1000 })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('수입을 삭제한다', async () => {
      const response = await incomeApi.delete(1)
      expect(response.status).toBe(204)
    })

    it('존재하지 않는 ID로 삭제 시 에러를 반환한다', async () => {
      await expect(incomeApi.delete(999)).rejects.toThrow()
    })
  })

  describe('getStats', () => {
    it('기간별 수입 통계를 조회한다', async () => {
      const response = await incomeApi.getStats('monthly')
      expect(response.data).toEqual(mockIncomeStats)
      expect(response.data.period).toBe('monthly')
      expect(response.data.total).toBeGreaterThan(0)
    })
  })
})
