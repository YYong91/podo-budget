/**
 * @file admin.test.ts
 * @description 관리자 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { adminApi } from '../admin'
import { mockDashboardStats } from '../../mocks/fixtures'

describe('adminApi', () => {
  describe('getDashboardStats', () => {
    it('대시보드 통계를 조회한다', async () => {
      const response = await adminApi.getDashboardStats()
      expect(response.data).toEqual(mockDashboardStats)
      expect(response.data.total_users).toBeGreaterThan(0)
    })
  })

  describe('getUserList', () => {
    it('사용자 목록을 조회한다', async () => {
      const response = await adminApi.getUserList()
      expect(response.data.users).toBeDefined()
      expect(Array.isArray(response.data.users)).toBe(true)
      expect(response.data.total).toBeGreaterThan(0)
    })

    it('페이지네이션 파라미터를 전달한다', async () => {
      const response = await adminApi.getUserList(2, 10)
      expect(response.data.page).toBe(2)
      expect(response.data.page_size).toBe(10)
    })
  })

  describe('getUserDetail', () => {
    it('사용자 상세 정보를 조회한다', async () => {
      const response = await adminApi.getUserDetail(1)
      expect(response.data.id).toBe(1)
      expect(response.data.username).toBeDefined()
    })
  })

  describe('updateUser', () => {
    it('사용자 정보를 수정한다', async () => {
      const response = await adminApi.updateUser(1, { is_active: false })
      expect(response.data.is_active).toBe(false)
    })
  })
})
