/**
 * @file ProtectedRoute.test.tsx
 * @description ProtectedRoute 컴포넌트 테스트
 * podo-auth SSO 연동 후 인증 상태에 따른 라우트 보호 동작을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

// useAuth 훅을 모킹한다
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockLocationHref.mockClear()
  })

  it('인증된 사용자일 때 자식 라우트를 렌더링한다', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', email: null, is_active: true, created_at: '2024-01-01' },
      loading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText('보호된 페이지')).toBeInTheDocument()
  })

  it('인증되지 않은 사용자일 때 podo-auth로 리다이렉트한다', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    })

    renderProtectedRoute()

    await waitFor(() => {
      expect(mockLocationHref).toHaveBeenCalledWith(
        expect.stringContaining('login?redirect_uri=')
      )
    })
    expect(screen.queryByText('보호된 페이지')).not.toBeInTheDocument()
  })

  it('로딩 중일 때 로딩 상태를 표시한다', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    })

    renderProtectedRoute()

    expect(screen.getByText('로딩 중...')).toBeInTheDocument()
    expect(screen.queryByText('보호된 페이지')).not.toBeInTheDocument()
  })

  it('로딩 중일 때 스피너 아이콘을 표시한다', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    })

    const { container } = renderProtectedRoute()

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('animate-spin')
  })
})
