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

const mockUpdateUser = vi.fn().mockResolvedValue({ error: null })
const mockSignOut = vi.fn().mockResolvedValue({ error: null })

vi.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

const mockAddToast = vi.fn()
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

const mockLogout = vi.fn()
const mockRefreshUser = vi.fn().mockResolvedValue(undefined)

/** useAuth 반환값을 동적으로 교체하기 위한 설정 */
let authOverrides: Record<string, unknown> = {}
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
      is_telegram_linked: false,
      is_kakao_linked: false,
      ...authOverrides,
    },
    isAuthenticated: true,
    loading: false,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
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
    authOverrides = {}
  })

  // ==================== 기본 정보 ====================

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

  // ==================== 연동 서비스 ====================

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

  it('카카오 연동 코드 발급 시 코드가 표시된다', async () => {
    server.use(
      http.post('/api/auth/kakao-link-code', () =>
        HttpResponse.json({
          code: 'KK-TEST99',
          expires_at: '2026-03-19T12:00:00Z',
        })
      )
    )

    const user = userEvent.setup()
    renderMyAccount()

    const codeBtns = await screen.findAllByRole('button', { name: '연동 코드 발급' })
    // 카카오는 두 번째 발급 버튼
    await user.click(codeBtns[1])

    await waitFor(() => {
      expect(screen.getByText('KK-TEST99')).toBeInTheDocument()
    })
  })

  it('텔레그램 연동 상태에서 연동 해제 버튼을 표시한다', () => {
    authOverrides = { is_telegram_linked: true }
    renderMyAccount()
    expect(screen.getByText('연동 해제')).toBeInTheDocument()
  })

  it('텔레그램 연동 해제를 실행한다', async () => {
    authOverrides = { is_telegram_linked: true }
    server.use(
      http.delete('/api/auth/telegram/link', () => HttpResponse.json(null, { status: 204 }))
    )

    const user = userEvent.setup()
    renderMyAccount()

    await user.click(screen.getByText('연동 해제'))

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled()
    })
  })

  it('카카오 연동 상태에서 연동 해제 버튼을 표시한다', () => {
    authOverrides = { is_kakao_linked: true }
    renderMyAccount()
    expect(screen.getByText('연동 해제')).toBeInTheDocument()
  })

  it('카카오 연동 해제를 실행한다', async () => {
    authOverrides = { is_kakao_linked: true }
    server.use(
      http.delete('/api/auth/kakao/link', () => HttpResponse.json(null, { status: 204 }))
    )

    const user = userEvent.setup()
    renderMyAccount()

    await user.click(screen.getByText('연동 해제'))

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled()
    })
  })

  // ==================== 비밀번호 변경 ====================

  it('비밀번호 변경 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('비밀번호 변경')).toBeInTheDocument()
  })

  it('비밀번호 변경 버튼 클릭 시 폼이 표시된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))
    expect(screen.getByPlaceholderText('새 비밀번호 (6자 이상)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toBeInTheDocument()
  })

  it('비밀번호 변경 폼에서 취소 클릭 시 폼이 닫힌다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))
    expect(screen.getByPlaceholderText('새 비밀번호 (6자 이상)')).toBeInTheDocument()

    await user.click(screen.getByText('취소'))
    expect(screen.queryByPlaceholderText('새 비밀번호 (6자 이상)')).not.toBeInTheDocument()
  })

  it('비밀번호 불일치 시 에러를 표시한다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'password123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'differentpassword')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(screen.getByText('새 비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 성공 시 토스트를 표시하고 폼을 닫는다', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'newpassword123')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    })
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '비밀번호가 변경되었습니다')
    })
    // 폼이 닫힌다
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('새 비밀번호 (6자 이상)')).not.toBeInTheDocument()
    })
  })

  it('비밀번호 변경 API 에러 시 에러 메시지를 표시한다 (6자 미만)', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('Password should be at least 6 characters') })

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'abc123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'abc123')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(screen.getByText('비밀번호는 6자 이상이어야 합니다')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 API 에러 시 에러 메시지를 표시한다 (동일 비밀번호)', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('New password should be different from the old password. Please use a same password or choose a different one') })

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'samepassword')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'samepassword')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(screen.getByText('현재 비밀번호와 동일합니다')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 API 에러 시 일반 에러 메시지를 표시한다', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('Unknown server error') })

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'newpass123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'newpass123')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(screen.getByText('Unknown server error')).toBeInTheDocument()
    })
  })

  // ==================== 로그아웃 ====================

  it('로그아웃 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('로그아웃')).toBeInTheDocument()
  })

  it('로그아웃 버튼 클릭 시 logout을 호출한다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('로그아웃'))
    expect(mockLogout).toHaveBeenCalled()
  })

  // ==================== 계정 삭제 ====================

  it('계정 삭제 버튼을 표시한다', () => {
    renderMyAccount()
    expect(screen.getByText('계정 삭제')).toBeInTheDocument()
  })

  it('계정 삭제 버튼 클릭 시 확인 폼이 표시된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))
    expect(screen.getByText('계정을 정말 삭제하시겠습니까?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('삭제')).toBeInTheDocument()
  })

  it('삭제 텍스트 미입력 시 삭제 버튼이 비활성화된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))
    const deleteBtn = screen.getByText('계정 영구 삭제')
    expect(deleteBtn).toBeDisabled()
  })

  it('삭제 텍스트 입력 후 삭제 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))

    await user.type(screen.getByPlaceholderText('삭제'), '삭제')
    const deleteBtn = screen.getByText('계정 영구 삭제')
    expect(deleteBtn).not.toBeDisabled()
  })

  it('계정 삭제 확인 폼에서 취소하면 원래 상태로 돌아간다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))
    expect(screen.getByText('계정을 정말 삭제하시겠습니까?')).toBeInTheDocument()

    await user.click(screen.getByText('취소'))
    expect(screen.queryByText('계정을 정말 삭제하시겠습니까?')).not.toBeInTheDocument()
    // 원래 계정 삭제 버튼이 다시 보인다
    expect(screen.getByText('계정 삭제')).toBeInTheDocument()
  })

  it('계정 삭제를 실행하면 API 호출 후 로그아웃된다', async () => {
    // 컴포넌트가 apiClient.delete('/api/auth/me')를 호출 → baseURL '/api' + '/api/auth/me'
    server.use(
      http.delete('*/api/auth/me', () => HttpResponse.json(null, { status: 200 }))
    )

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))

    await user.type(screen.getByPlaceholderText('삭제'), '삭제')
    await user.click(screen.getByText('계정 영구 삭제'))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  it('계정 삭제 API 실패 시 에러 토스트를 표시한다', async () => {
    server.use(
      http.delete('*/api/auth/me', () => HttpResponse.json({ detail: 'Error' }, { status: 500 }))
    )

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))

    await user.type(screen.getByPlaceholderText('삭제'), '삭제')
    await user.click(screen.getByText('계정 영구 삭제'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '계정 삭제에 실패했습니다. 다시 시도해주세요.')
    })
  })

  // ==================== 비밀번호 변경: 로딩 상태 ====================

  it('비밀번호 변경 중 버튼에 "변경 중..." 텍스트가 표시된다', async () => {
    // updateUser가 resolve되지 않도록 pending 상태를 유지
    let resolveUpdate!: (v: { error: null }) => void
    mockUpdateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'newpass123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'newpass123')
    await user.click(screen.getByText('변경'))

    // 로딩 중 텍스트 확인
    await waitFor(() => {
      expect(screen.getByText('변경 중...')).toBeInTheDocument()
    })

    // cleanup: resolve to avoid act warning
    resolveUpdate({ error: null })
  })

  // ==================== 계정 삭제: 잘못된 확인 텍스트 ====================

  it('삭제 확인란에 잘못된 텍스트를 입력하면 삭제 버튼이 비활성화 상태를 유지한다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))

    await user.type(screen.getByPlaceholderText('삭제'), '삭제하겠습니다')
    const deleteBtn = screen.getByText('계정 영구 삭제')
    expect(deleteBtn).toBeDisabled()
  })

  // ==================== 이메일 미등록 ====================

  it('이메일이 없으면 미등록으로 표시한다', () => {
    authOverrides = { email: null }
    renderMyAccount()
    expect(screen.getByText('미등록')).toBeInTheDocument()
  })

  // ==================== 계정 삭제 후 signOut 호출 ====================

  it('계정 삭제 성공 시 Supabase signOut을 호출한다', async () => {
    server.use(
      http.delete('*/api/auth/me', () => HttpResponse.json(null, { status: 200 }))
    )

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('계정 삭제'))

    await user.type(screen.getByPlaceholderText('삭제'), '삭제')
    await user.click(screen.getByText('계정 영구 삭제'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockAddToast).toHaveBeenCalledWith('success', '계정이 삭제되었습니다')
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  // ==================== 비밀번호 변경 후 필드 초기화 ====================

  it('비밀번호 변경 성공 후 입력 필드가 초기화된다', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })

    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'newpassword123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'newpassword123')
    await user.click(screen.getByText('변경'))

    // 폼이 닫힌 후 다시 열면 필드가 비어있어야 한다
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('새 비밀번호 (6자 이상)')).not.toBeInTheDocument()
    })

    // 다시 열기
    await user.click(screen.getByText('비밀번호 변경'))
    expect(screen.getByPlaceholderText('새 비밀번호 (6자 이상)')).toHaveValue('')
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toHaveValue('')
  })

  // ==================== 비밀번호 변경 취소 시 에러 메시지 초기화 ====================

  it('비밀번호 변경 취소 시 에러 메시지가 사라진다', async () => {
    const user = userEvent.setup()
    renderMyAccount()
    await user.click(screen.getByText('비밀번호 변경'))

    // 불일치로 에러 유발
    await user.type(screen.getByPlaceholderText('새 비밀번호 (6자 이상)'), 'password123')
    await user.type(screen.getByPlaceholderText('새 비밀번호 확인'), 'different')
    await user.click(screen.getByText('변경'))

    await waitFor(() => {
      expect(screen.getByText('새 비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    })

    // 취소
    await user.click(screen.getByText('취소'))

    // 다시 열기 — 에러 메시지 없어야 함
    await user.click(screen.getByText('비밀번호 변경'))
    expect(screen.queryByText('새 비밀번호가 일치하지 않습니다')).not.toBeInTheDocument()
  })
})
