/**
 * @file ProtectedRoute.test.tsx
 * @description ProtectedRoute 테스트 — Supabase Auth (#337)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

// useAuth 모킹
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

// useHouseholdStore 모킹
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        households: [{ id: 1 }],
        hasInitialized: true,
        initError: null,
        initializeApp: vi.fn().mockResolvedValue(undefined),
      }
      return selector ? selector(state) : state
    },
    { setState: vi.fn() }
  ),
}))

function renderWithRouter(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">로그인</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div data-testid="home-page">홈</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isAuthenticated = false
    mockAuth.loading = false
  })

  it('미인증 시 /login으로 리디렉션', async () => {
    mockAuth.isAuthenticated = false
    mockAuth.loading = false

    renderWithRouter('/')

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('인증 시 자식 라우트 렌더링', async () => {
    mockAuth.isAuthenticated = true
    mockAuth.loading = false

    renderWithRouter('/')

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  it('로딩 중 로딩 UI 표시', () => {
    mockAuth.isAuthenticated = false
    mockAuth.loading = true

    renderWithRouter('/')

    // 로딩 스피너 (포도 로고 이미지)
    expect(screen.getByAltText('포도가계부')).toBeInTheDocument()
  })
})
