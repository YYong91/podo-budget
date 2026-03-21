/**
 * @file AuthContext.test.tsx
 * @description AuthContext 테스트 (#153)
 *
 * isTokenExpired 함수의 base64url 처리와
 * 토큰 만료 체크 인터벌(30초)을 검증한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

/** authApi 모킹 — AuthProvider 내부 getCurrentUser 호출 대응 */
vi.mock('../../api/auth', () => ({
  default: {
    getCurrentUser: vi.fn().mockResolvedValue({ data: { id: 1, username: 'testuser', email: null, is_active: true } }),
    logout: vi.fn(),
  },
}))

/** JWT 토큰 생성 헬퍼 (base64url 인코딩, Unicode 안전) */
function makeJwt(payload: Record<string, unknown>): string {
  // TextEncoder를 사용해 한국어 등 유니코드 문자를 UTF-8 바이트로 안전하게 인코딩 (#153)
  const encodeBase64Url = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    bytes.forEach((b) => { binary += String.fromCharCode(b) })
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' })
  const body = encodeBase64Url(payload)
  return `${header}.${body}.fake-signature`
}

/** AuthContext를 소비하는 테스트용 컴포넌트 */
function TestConsumer() {
  const { isAuthenticated } = useAuth()
  return <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    document.cookie = 'podo_access_token=; Max-Age=0; Path=/'
    try { localStorage.removeItem('podo_access_token') } catch { /* 무시 */ }
  })

  afterEach(() => {
    document.cookie = 'podo_access_token=; Max-Age=0; Path=/'
    try { localStorage.removeItem('podo_access_token') } catch { /* 무시 */ }
  })

  describe('isTokenExpired — base64url 디코딩 (#153)', () => {
    it('미래 exp를 가진 base64url JWT를 유효한 토큰으로 인식한다', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600
      const token = makeJwt({ sub: '1', exp: futureExp, username: 'testuser' })
      document.cookie = `podo_access_token=${token}; Path=/`

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    })

    it('만료된 exp를 가진 토큰은 미인증으로 처리한다', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 1
      const token = makeJwt({ sub: '1', exp: pastExp })
      document.cookie = `podo_access_token=${token}; Path=/`

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })

    /**
     * 핵심 버그 재현 (#153): 한국어 username이 포함된 JWT
     * atob()만 사용하면 base64url 패딩 없이 디코딩 실패 → 예외 → 유효 토큰을 만료로 오인
     * 수정 후: base64url → base64 변환 후 디코딩 → 정상 처리
     */
    it('한국어 username이 포함된 base64url JWT를 유효한 토큰으로 인식한다 (#153)', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600
      const token = makeJwt({ sub: '1', exp: futureExp, username: '홍길동' })
      document.cookie = `podo_access_token=${token}; Path=/`

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      // 한국어 username이 있어도 base64url 처리 후 유효한 토큰으로 인식해야 함
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    })

    it('손상된 토큰은 미인증으로 처리한다', () => {
      document.cookie = 'podo_access_token=not.a.valid.jwt; Path=/'

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })
  })

  describe('토큰 만료 체크 인터벌 (#153)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    /**
     * 30초 인터벌 검증: 쿠키가 제거된 상태에서 30초 후 미인증으로 전환
     * 5분 인터벌이면 30초에는 체크가 발생하지 않아 인증 상태가 유지됨
     */
    it('쿠키 제거 후 30초 이내에 미인증으로 전환된다 (#153)', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600
      const token = makeJwt({ sub: '1', exp: futureExp })
      document.cookie = `podo_access_token=${token}; Path=/`

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      // 초기: 인증 상태
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')

      // 쿠키 제거 (만료 시뮬레이션)
      document.cookie = 'podo_access_token=; Max-Age=0; Path=/'

      // 30초 인터벌 시뮬레이션
      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })

      // 30초 후: 미인증 상태
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })
  })
})
