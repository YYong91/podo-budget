/**
 * @file ProtectedRoute.test.tsx
 * @description ProtectedRoute 컴포넌트 테스트
 * podo-auth SSO 연동 후 인증 상태에 따른 라우트 보호 동작을 테스트한다.
 * isAuthenticated (토큰 기반, 동기적)를 사용하는 새 구조 기준.
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
})
