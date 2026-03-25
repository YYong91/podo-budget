/**
 * @file AuthCallbackPage.test.tsx
 * @description AuthCallbackPage 테스트 — Supabase OAuth/Recovery 콜백 (#337)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

// onAuthStateChange 콜백을 캡처하기 위한 변수
let authStateCallback: ((event: string) => void) | null = null

const mockUpdateUser = vi.fn()

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authStateCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}))

function renderCallbackPage(initialPath = '/auth/callback') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<div data-testid="home">홈</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isAuthenticated = false
    authStateCallback = null
    window.location.hash = ''
  })

  it('로그인 처리 중 메시지를 표시한다', () => {
    renderCallbackPage()
    expect(screen.getByText('로그인 처리 중...')).toBeInTheDocument()
  })

  it('인증 완료 시 홈으로 이동한다', async () => {
    mockAuth.isAuthenticated = true
    renderCallbackPage()

    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
  })

  it('PASSWORD_RECOVERY 이벤트 시 비밀번호 변경 폼을 표시한다', async () => {
    renderCallbackPage()

    // PASSWORD_RECOVERY 이벤트 발생
    if (authStateCallback) authStateCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument()
      expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument()
      expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument()
    })
  })

  it('비밀번호 불일치 시 에러를 표시한다', async () => {
    renderCallbackPage()
    if (authStateCallback) authStateCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'different' } })
    fireEvent.click(screen.getByText('비밀번호 변경'))

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 성공 시 updateUser를 호출한다', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    // recovery 모드 먼저 진입 후 인증 상태 설정
    renderCallbackPage()
    if (authStateCallback) authStateCallback('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByText('비밀번호 변경'))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' })
    })
  })
})
