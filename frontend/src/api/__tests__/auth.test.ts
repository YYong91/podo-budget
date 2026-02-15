/**
 * @file auth.test.ts
 * @description 인증 API 단위 테스트
 * authApi의 모든 메서드를 MSW로 테스트한다.
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

// 테스트용 토큰 응답
const mockAuthResponse = {
  access_token: 'test-token-abc123',
  token_type: 'bearer',
}

// 핸들러 정의
const authHandlers = [
  http.post(`${BASE_URL}/auth/login`, () =>
    HttpResponse.json(mockAuthResponse)
  ),
  http.post(`${BASE_URL}/auth/register`, () =>
    HttpResponse.json(mockUser, { status: 201 })
  ),
  http.get(`${BASE_URL}/auth/me`, () =>
    HttpResponse.json(mockUser)
  ),
  http.delete(`${BASE_URL}/auth/me`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.post(`${BASE_URL}/auth/forgot-password`, () =>
    HttpResponse.json({ message: 'ok' })
  ),
  http.post(`${BASE_URL}/auth/reset-password`, () =>
    HttpResponse.json({ message: 'ok' })
  ),
]

describe('authApi', () => {
  // afterEach에서 resetHandlers 되므로 매 테스트 전 핸들러 재등록
  beforeEach(() => {
    server.use(...authHandlers)
  })

  describe('login', () => {
    it('POST /api/auth/login을 호출하여 토큰을 반환한다', async () => {
      const response = await authApi.login({
        username: 'test',
        password: 'password123', // pragma: allowlist secret // pragma: allowlist secret
      })

      expect(response.data).toEqual(mockAuthResponse)
      expect(response.data.access_token).toBe('test-token-abc123')
      expect(response.data.token_type).toBe('bearer')
    })
  })

  describe('register', () => {
    it('POST /api/auth/register를 호출하여 사용자를 생성한다', async () => {
      const response = await authApi.register({
        username: 'test',
        password: 'password123', // pragma: allowlist secret
      })

      expect(response.data).toEqual(mockUser)
      expect(response.status).toBe(201)
    })
  })

  describe('getCurrentUser', () => {
    it('GET /api/auth/me를 호출하여 현재 사용자 정보를 반환한다', async () => {
      const response = await authApi.getCurrentUser()

      expect(response.data).toEqual(mockUser)
      expect(response.data.id).toBe(1)
      expect(response.data.username).toBe('test')
    })
  })

  describe('deleteAccount', () => {
    it('DELETE /api/auth/me를 호출하여 계정을 삭제한다', async () => {
      const response = await authApi.deleteAccount()

      expect(response.status).toBe(204)
    })
  })

  describe('forgotPassword', () => {
    it('POST /api/auth/forgot-password를 호출한다', async () => {
      const response = await authApi.forgotPassword('test@example.com')

      expect(response.data).toEqual({ message: 'ok' })
    })
  })

  describe('resetPassword', () => {
    it('POST /api/auth/reset-password를 호출한다', async () => {
      const response = await authApi.resetPassword('reset-token', 'newpassword123')

      expect(response.data).toEqual({ message: 'ok' })
    })
  })
})
