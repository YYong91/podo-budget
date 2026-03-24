/**
 * @file AuthContext.test.tsx
 * @description AuthContext 테스트 — Supabase Auth (#337)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

// Supabase 모킹
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: unknown) => {
        mockOnAuthStateChange(cb)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signOut: () => mockSignOut(),
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// authApi 모킹
vi.mock('../../api/auth', () => ({
  default: {
    getCurrentUser: vi.fn().mockResolvedValue({
      data: { id: 1, username: 'testuser', email: 'test@example.com', is_active: true },
    }),
  },
}))

// analytics 모킹
vi.mock('../../utils/analytics', () => ({
  identifyUser: vi.fn(),
}))

function TestConsumer() {
  const { isAuthenticated, loading, user } = useAuth()
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user?.username || 'none'}</span>
    </div>
  )
}

describe('AuthContext (Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('세션이 없으면 미인증 상태', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })
  })

  it('세션이 있으면 인증 상태 + 프로필 로드', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fake-token',
          user: { id: 'uuid-123', email: 'test@example.com' },
        },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    })
  })

  it('초기 로딩 상태를 표시한다', () => {
    // getSession이 아직 resolve 안 됨
    mockGetSession.mockReturnValue(new Promise(() => {}))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })
})
