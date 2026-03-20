/**
 * @file AuthCallbackPage.test.tsx
 * @description SSO 콜백 페이지 테스트
 * 토큰 처리 및 인증 후 리다이렉트 동작을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthCallbackPage from '../AuthCallbackPage'

// 네비게이션 모킹
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

// AuthContext 모킹
const mockSetTokenFromCallback = vi.fn()
let mockIsAuthenticated = false

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    setTokenFromCallback: mockSetTokenFromCallback,
    isAuthenticated: mockIsAuthenticated,
  }),
}))

function renderAuthCallback(search = '') {
  // window.location.search를 모킹하기 위해 jsdom URL을 설정
  Object.defineProperty(window, 'location', {
    value: { search, href: `http://localhost${search}` },
    writable: true,
  })

  return render(
    <MemoryRouter>
      <AuthCallbackPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockSetTokenFromCallback.mockClear()
  mockIsAuthenticated = false
  sessionStorage.clear()
})

describe('AuthCallbackPage', () => {
  describe('기본 렌더링', () => {
    it('로딩 스피너를 표시한다', () => {
      renderAuthCallback()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('"로그인 처리 중..." 텍스트를 표시한다', () => {
      renderAuthCallback()
      expect(screen.getByText('로그인 처리 중...')).toBeInTheDocument()
    })
  })

  describe('URL 토큰 없음 (Chrome 쿠키 기반)', () => {
    it('urlToken 없으면 즉시 홈("/")으로 이동한다', async () => {
      renderAuthCallback('')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })

    it('urlToken 없으면 setTokenFromCallback을 호출하지 않는다', () => {
      renderAuthCallback('')
      expect(mockSetTokenFromCallback).not.toHaveBeenCalled()
    })
  })

  describe('URL 토큰 있음 (Safari localStorage 기반)', () => {
    it('urlToken이 있으면 setTokenFromCallback을 호출한다', async () => {
      renderAuthCallback('?token=my-test-token')

      await waitFor(() => {
        expect(mockSetTokenFromCallback).toHaveBeenCalledWith('my-test-token')
      })
    })

    it('인증 완료(isAuthenticated=true) 후 홈으로 이동한다', async () => {
      mockIsAuthenticated = true
      renderAuthCallback('?token=my-test-token')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })
  })

  describe('의도했던 경로(intended_path) 복원', () => {
    it('sessionStorage에 intended_path가 있으면 해당 경로로 이동한다', async () => {
      sessionStorage.setItem('intended_path', '/income')
      renderAuthCallback('')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/income', { replace: true })
      })
    })

    it('이동 후 sessionStorage의 intended_path를 삭제한다', async () => {
      sessionStorage.setItem('intended_path', '/income')
      renderAuthCallback('')

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })

      expect(sessionStorage.getItem('intended_path')).toBeNull()
    })
  })
})
