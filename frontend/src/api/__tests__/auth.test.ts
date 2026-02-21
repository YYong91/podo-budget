/**
 * @file auth.test.ts
 * @description 인증 API 단위 테스트
 * podo-auth SSO 연동 후 getCurrentUser만 테스트한다.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import authApi from '../auth'

const BASE_URL = '/api'

// 테스트용 사용자 데이터
const mockUser = {
  id: 1,
  username: 'test',
  email: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

// 핸들러 정의
const authHandlers = [
  http.get(`${BASE_URL}/auth/me`, () =>
    HttpResponse.json(mockUser)
  ),
]

describe('authApi', () => {
  beforeEach(() => {
    server.use(...authHandlers)
  })

  describe('getCurrentUser', () => {
    it('GET /api/auth/me를 호출하여 현재 사용자 정보를 반환한다', async () => {
      const response = await authApi.getCurrentUser()

      expect(response.data).toEqual(mockUser)
      expect(response.data.id).toBe(1)
      expect(response.data.username).toBe('test')
    })
  })
})
