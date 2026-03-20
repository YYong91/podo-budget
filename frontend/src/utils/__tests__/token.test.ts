/**
 * @file token.test.ts
 * @description token 유틸리티 테스트
 * 쿠키 파싱, localStorage 폴백 동작을 검증한다.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCookieToken } from '../token'

beforeEach(() => {
  // 각 테스트 전 쿠키와 localStorage 초기화
  document.cookie = 'podo_access_token=; Max-Age=0; Path=/'
  try { localStorage.removeItem('podo_access_token') } catch { /* 무시 */ }
})

afterEach(() => {
  document.cookie = 'podo_access_token=; Max-Age=0; Path=/'
  try { localStorage.removeItem('podo_access_token') } catch { /* 무시 */ }
})

describe('getCookieToken', () => {
  describe('쿠키에서 토큰 읽기', () => {
    it('쿠키에 토큰이 있으면 반환한다', () => {
      document.cookie = 'podo_access_token=my-cookie-token; Path=/'

      const token = getCookieToken()
      expect(token).toBe('my-cookie-token')
    })

    it('쿠키에 다른 쿠키와 함께 있어도 올바르게 파싱한다', () => {
      document.cookie = 'other_cookie=some-value; Path=/'
      document.cookie = 'podo_access_token=my-real-token; Path=/'

      const token = getCookieToken()
      expect(token).toBe('my-real-token')
    })

    it('쿠키가 없으면 localStorage를 확인한다', () => {
      localStorage.setItem('podo_access_token', 'local-storage-token')

      const token = getCookieToken()
      expect(token).toBe('local-storage-token')
    })
  })

  describe('localStorage 폴백', () => {
    it('쿠키가 없고 localStorage에 토큰이 있으면 반환한다', () => {
      localStorage.setItem('podo_access_token', 'fallback-token')

      const token = getCookieToken()
      expect(token).toBe('fallback-token')
    })

    it('쿠키와 localStorage 모두 없으면 null을 반환한다', () => {
      const token = getCookieToken()
      expect(token).toBeNull()
    })

    it('쿠키가 있으면 localStorage를 무시하고 쿠키 값을 반환한다', () => {
      document.cookie = 'podo_access_token=cookie-wins; Path=/'
      localStorage.setItem('podo_access_token', 'local-loses')

      const token = getCookieToken()
      expect(token).toBe('cookie-wins')
    })
  })

  describe('localStorage 접근 오류 대응', () => {
    it('localStorage 접근이 차단되면 null을 반환한다 (Safari Private 모드)', () => {
      // localStorage.getItem을 throw하도록 모킹
      const originalGetItem = Storage.prototype.getItem
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage is not available in private mode')
      })

      const token = getCookieToken()
      expect(token).toBeNull()

      Storage.prototype.getItem = originalGetItem
    })
  })
})
