/**
 * @file recurring.test.ts
 * @description 정기 거래 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { recurringApi } from '../recurring'
import { mockRecurringTransactions } from '../../mocks/fixtures'

describe('recurringApi', () => {
  describe('getAll', () => {
    it('모든 정기 거래 목록을 조회한다', async () => {
      const response = await recurringApi.getAll()
      expect(response.data).toEqual(mockRecurringTransactions)
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('타입별 필터로 지출만 조회한다', async () => {
      const response = await recurringApi.getAll({ type: 'expense' })
      expect(response.data.every((r) => r.type === 'expense')).toBe(true)
    })

    it('타입별 필터로 수입만 조회한다', async () => {
      const response = await recurringApi.getAll({ type: 'income' })
      expect(response.data.every((r) => r.type === 'income')).toBe(true)
    })
  })

  describe('getPending', () => {
    it('대기 중인 정기 거래 목록을 조회한다', async () => {
      const response = await recurringApi.getPending(1)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.every((r) => r.is_active)).toBe(true)
    })
  })

  describe('getById', () => {
    it('ID로 단일 정기 거래를 조회한다', async () => {
      const response = await recurringApi.getById(1)
      expect(response.data).toEqual(mockRecurringTransactions[0])
    })

    it('존재하지 않는 ID로 조회 시 에러를 반환한다', async () => {
      await expect(recurringApi.getById(999)).rejects.toThrow()
    })
  })

  describe('create', () => {
    it('새로운 정기 거래를 생성한다', async () => {
      const newRecurring = {
        type: 'expense' as const,
        amount: 10000,
        description: '구독료',
        frequency: 'monthly' as const,
        day_of_month: 15,
        start_date: '2026-03-01',
      }
      const response = await recurringApi.create(newRecurring)
      expect(response.data).toMatchObject({
        description: '구독료',
        amount: 10000,
        frequency: 'monthly',
      })
      expect(response.data.id).toBeDefined()
    })
  })

  describe('update', () => {
    it('정기 거래를 수정한다', async () => {
      const updates = { amount: 20000, description: '수정된 구독료' }
      const response = await recurringApi.update(1, updates)
      expect(response.data.amount).toBe(20000)
      expect(response.data.description).toBe('수정된 구독료')
    })

    it('존재하지 않는 ID로 수정 시 에러를 반환한다', async () => {
      await expect(recurringApi.update(999, { amount: 1000 })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('정기 거래를 삭제한다', async () => {
      const response = await recurringApi.delete(1)
      expect(response.status).toBe(204)
    })

    it('존재하지 않는 ID로 삭제 시 에러를 반환한다', async () => {
      await expect(recurringApi.delete(999)).rejects.toThrow()
    })
  })

  describe('execute', () => {
    it('정기 거래를 실행한다', async () => {
      const response = await recurringApi.execute(1)
      expect(response.data.message).toBeDefined()
      expect(response.data.created_id).toBeGreaterThan(0)
      expect(response.data.next_due_date).toBeDefined()
    })

    it('존재하지 않는 ID로 실행 시 에러를 반환한다', async () => {
      await expect(recurringApi.execute(999)).rejects.toThrow()
    })
  })

  describe('skip', () => {
    it('정기 거래를 건너뛴다', async () => {
      const response = await recurringApi.skip(1)
      expect(response.data.next_due_date).toBeDefined()
    })

    it('존재하지 않는 ID로 건너뛰기 시 에러를 반환한다', async () => {
      await expect(recurringApi.skip(999)).rejects.toThrow()
    })
  })
})
