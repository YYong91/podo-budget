/**
 * @file ProtectedRoute.test.tsx
 * @description ProtectedRoute 컴포넌트 테스트
 * 인증 상태에 따른 라우트 보호 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

// useAuth 훅을 모킹한다
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

/**
 * ProtectedRoute 렌더링 헬퍼
 * MemoryRouter로 감싸고 자식 라우트와 로그인 페이지를 설정한다
 */
const renderProtectedRoute = () => {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>보호된 페이지</div>} />
        </Route>
        <Route path="/login" element={<div>로그인 페이지</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('인증된 사용자일 때 자식 라우트를 렌더링한다', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', email: null, is_active: true, created_at: '2024-01-01' },
      loading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText('보호된 페이지')).toBeInTheDocument()
    expect(screen.queryByText('로그인 페이지')).not.toBeInTheDocument()
  })

  it('인증되지 않은 사용자일 때 /login으로 리다이렉트한다', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText('로그인 페이지')).toBeInTheDocument()
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
    expect(screen.queryByText('로그인 페이지')).not.toBeInTheDocument()
  })

  it('로딩 중일 때 스피너 아이콘을 표시한다', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    })

    const { container } = renderProtectedRoute()

    // Loader2 아이콘은 SVG로 렌더링됨
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('animate-spin')
  })
})
