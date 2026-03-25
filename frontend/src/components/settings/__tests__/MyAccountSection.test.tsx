/**
 * @file MyAccountSection.test.tsx
 * @description MyAccountSection 컴포넌트 테스트 — 계정 정보, 봇 연동, 비밀번호 변경, 계정 삭제 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import SettingsPage from '../../../pages/SettingsPage'

vi.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
      is_telegram_linked: false,
    },
    isAuthenticated: true,
    loading: false,
    refreshUser: vi.fn(),
    logout: vi.fn(),
  }),
}))

// IntersectionObserver mock
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
} as unknown as typeof globalThis.IntersectionObserver

function renderMyAccount() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/settings/my-account']}>
        <Routes>
          <Route path="/settings/:section" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('MyAccountSection 컴포넌트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('기본 정보 (사용자명, 이메일, 가입일)를 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('기본 정보')).toBeInTheDocument()
    expect(screen.getByText('사용자명')).toBeInTheDocument()
    expect(screen.getByText('testuser')).toBeInTheDocument()
    expect(screen.getByText('이메일')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
    expect(screen.getByText('가입일')).toBeInTheDocument()
    expect(screen.getByText('2024.01.15')).toBeInTheDocument()
  })

  it('연동 서비스 섹션을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('연동 서비스')).toBeInTheDocument()
    expect(screen.getByText('텔레그램')).toBeInTheDocument()
  })

  it('카카오톡 연동 섹션을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('카카오톡 연동')).toBeInTheDocument()
    expect(screen.getByText('카카오톡')).toBeInTheDocument()
  })

  it('비밀번호 변경 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('비밀번호 변경')).toBeInTheDocument()
  })

  it('로그아웃 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('로그아웃')).toBeInTheDocument()
  })

  it('계정 삭제 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('계정 삭제')).toBeInTheDocument()
  })

  it('미연동 상태에서는 연동 코드 발급 버튼이 표시된다', () => {
    renderMyAccount()
    const codeBtns = screen.getAllByRole('button', { name: '연동 코드 발급' })
    expect(codeBtns.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: '연동 해제' })).not.toBeInTheDocument()
  })

  it('텔레그램 연동 코드 발급 시 코드가 표시된다', async () => {
    server.use(
      http.post('/api/auth/telegram-link-code', () =>
        HttpResponse.json({
          code: 'TEST42',
          expires_at: '2026-03-19T12:00:00Z',
        })
      )
    )

    const user = userEvent.setup()
    renderMyAccount()

    const codeBtns = await screen.findAllByRole('button', { name: '연동 코드 발급' })
    await user.click(codeBtns[0])

    await waitFor(() => {
      expect(screen.getByText('TEST42')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 버튼 클릭 시 폼이 표시된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))
    expect(screen.getByPlaceholderText('새 비밀번호 (6자 이상)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toBeInTheDocument()
  })

  it('계정 삭제 버튼 클릭 시 확인 폼이 표시된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))
    expect(screen.getByText('계정을 정말 삭제하시겠습니까?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('삭제')).toBeInTheDocument()
  })
})
