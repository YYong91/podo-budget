/**
 * @file AuthCallbackPage.test.tsx
 * @description AuthCallbackPage 테스트 — Supabase OAuth 콜백 (#337)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthCallbackPage from '../AuthCallbackPage'

const mockAuth = {
  isAuthenticated: false,
  loading: false,
  user: null,
  logout: vi.fn(),
  refreshUser: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isAuthenticated = false
  })

  it('로그인 처리 중 메시지를 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('로그인 처리 중...')).toBeInTheDocument()
  })

  it('인증 완료 시 홈으로 이동한다', async () => {
    mockAuth.isAuthenticated = true

    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<div data-testid="home">홈</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
  })
})
