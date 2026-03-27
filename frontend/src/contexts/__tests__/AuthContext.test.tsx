/**
 * @file AuthContext.test.tsx
 * @description AuthContext 테스트 — Supabase Auth (#337)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'

// Supabase 모킹
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshSession = vi.fn()

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: unknown) => {
        mockOnAuthStateChange(cb)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signOut: () => mockSignOut(),
      refreshSession: () => mockRefreshSession(),
    },
  },
}))

// authApi 모킹
const mockGetCurrentUser = vi.fn()
vi.mock('../../api/auth', () => ({
  default: {
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  },
}))

// analytics 모킹
vi.mock('../../utils/analytics', () => ({
  identifyUser: vi.fn(),
}))

// apiClient 인터셉터 모킹
vi.mock('../../api/client', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn().mockReturnValue(1), eject: vi.fn() },
      response: { use: vi.fn().mockReturnValue(2), eject: vi.fn() },
    },
  },
}))

function TestConsumer() {
  const { isAuthenticated, loading, user, logout, refreshUser } = useAuth()
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user?.username || 'none'}</span>
      <button data-testid="logout-btn" onClick={logout}>로그아웃</button>
      <button data-testid="refresh-btn" onClick={refreshUser}>새로고침</button>
    </div>
  )
}

describe('AuthContext (Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({
      data: { id: 1, username: 'testuser', email: 'test@example.com', is_active: true },
    })
    mockSignOut.mockResolvedValue({})
    mockRefreshSession.mockResolvedValue({ error: null })
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

  it('프로필 로드 실패 시에도 loadedSessionToken이 설정된다', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fail-token',
          user: { id: 'uuid-fail' },
        },
      },
    })
    mockGetCurrentUser.mockRejectedValue(new Error('네트워크 에러'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // 프로필 로드 실패해도 로딩은 끝나야 함
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    // 프로필 없으니 user는 null
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('logout 호출 시 signOut + 리디렉션', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-123',
          user: { id: 'uuid-123' },
        },
      },
    })

    // window.location.href 모킹
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    })

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    })

    await user.click(screen.getByTestId('logout-btn'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })

    // 복원
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  it('refreshUser 호출 시 프로필 갱신', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-abc',
          user: { id: 'uuid-abc' },
        },
      },
    })

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    })

    // 이름 변경된 데이터로 갱신
    mockGetCurrentUser.mockResolvedValue({
      data: { id: 1, username: 'updateduser', email: 'test@example.com', is_active: true },
    })

    await user.click(screen.getByTestId('refresh-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('updateduser')
    })
  })

  it('세션 없을 때 refreshUser 호출 시 아무것도 하지 않는다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    })

    await user.click(screen.getByTestId('refresh-btn'))

    // getCurrentUser가 초기 세션 없으므로 호출되지 않아야 함
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })

  it('onAuthStateChange 콜백이 등록된다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(mockOnAuthStateChange).toHaveBeenCalled()
  })

  it('useAuth를 Provider 밖에서 사용하면 에러를 던진다', () => {
    // 에러 출력 방지
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')

    spy.mockRestore()
  })

  it('세션은 있지만 프로필 아직 로드 전이면 loading 상태', async () => {
    // getSession은 즉시 resolve하지만, getCurrentUser는 천천히
    let resolveProfile: (v: unknown) => void
    const profilePromise = new Promise((resolve) => { resolveProfile = resolve })
    mockGetCurrentUser.mockReturnValue(profilePromise)

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'slow-token',
          user: { id: 'uuid-slow' },
        },
      },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // 세션은 로드됐지만 프로필은 아직 — loading
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    // 프로필 resolve
    await act(async () => {
      resolveProfile!({
        data: { id: 1, username: 'slowuser', email: 'slow@test.com', is_active: true },
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      expect(screen.getByTestId('user')).toHaveTextContent('slowuser')
    })
  })
})
