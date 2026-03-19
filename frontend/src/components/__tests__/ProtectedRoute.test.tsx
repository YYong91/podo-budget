/**
 * @file ProtectedRoute.test.tsx
 * @description ProtectedRoute 컴포넌트 테스트
 * podo-auth SSO 연동 후 인증 상태에 따른 라우트 보호 동작을 테스트한다.
 * isAuthenticated (토큰 기반, 동기적)를 사용하는 새 구조 기준.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

// useAuth 훅을 모킹한다
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// useHouseholdStore 모킹 — 기본적으로 가구 있는 상태 + 초기화 완료
const mockHouseholdState: {
  households: { id: number; name: string }[]
  isLoading: boolean
  hasInitialized: boolean
  initError: string | null
  initializeApp: ReturnType<typeof vi.fn>
} = {
  households: [{ id: 1, name: '테스트 가계부' }],
  isLoading: false,
  hasInitialized: true,
  initError: null,
  initializeApp: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockHouseholdState) : mockHouseholdState,
}))

// window.location.href 모킹
const mockLocationHref = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, set href(url: string) { mockLocationHref(url) } },
  writable: true,
})

const renderProtectedRoute = () => {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>보호된 페이지</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

/** /onboarding 라우트도 포함된 렌더 헬퍼 */
const renderProtectedRouteWithOnboarding = () => {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>보호된 페이지</div>} />
          <Route path="/onboarding" element={<div>온보딩 페이지</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockLocationHref.mockClear()
    // 각 테스트 전에 기본 상태로 초기화
    mockHouseholdState.households = [{ id: 1, name: '테스트 가계부' }]
    mockHouseholdState.hasInitialized = true
    mockHouseholdState.initError = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('인증된 사용자일 때 자식 라우트를 렌더링한다', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
    })

    renderProtectedRoute()

    expect(screen.getByText('보호된 페이지')).toBeInTheDocument()
  })

  it('인증되지 않은 사용자일 때 podo-auth로 리다이렉트한다', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
    })

    renderProtectedRoute()

    await waitFor(() => {
      expect(mockLocationHref).toHaveBeenCalledWith(
        expect.stringContaining('login?redirect_uri=')
      )
    })
    expect(screen.queryByText('보호된 페이지')).not.toBeInTheDocument()
  })

  it('인증되지 않은 사용자일 때 null을 렌더링한다', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
    })

    const { container } = renderProtectedRoute()

    expect(container.firstChild).toBeNull()
  })

  it('hasInitialized=false (초기화 중) 상태에서는 로딩 UI를 표시하고 보호된 페이지는 숨긴다', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockHouseholdState.hasInitialized = false

    renderProtectedRoute()

    // 로딩 스피너가 보여야 한다
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
    // 보호된 페이지 내용은 보이지 않아야 한다
    expect(screen.queryByText('보호된 페이지')).not.toBeInTheDocument()
  })

  it('initError 상태에서는 재시도 버튼이 표시된다', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    // hasInitialized=true이지만 initError가 있는 상태 — 현재 컴포넌트 로직: initError가 있으면 에러 UI
    mockHouseholdState.hasInitialized = true
    mockHouseholdState.initError = '서버 에러'

    renderProtectedRoute()

    expect(screen.getByText('다시 시도')).toBeInTheDocument()
    expect(screen.queryByText('보호된 페이지')).not.toBeInTheDocument()
  })

  it('가구가 없으면 /onboarding으로 navigate한다', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockHouseholdState.hasInitialized = true
    mockHouseholdState.initError = null
    mockHouseholdState.households = []

    renderProtectedRouteWithOnboarding()

    await waitFor(() => {
      expect(screen.getByText('온보딩 페이지')).toBeInTheDocument()
    })
  })
})
