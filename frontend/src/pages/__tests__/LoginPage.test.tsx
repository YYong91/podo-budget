/**
 * @file LoginPage.test.tsx
 * @description LoginPage 로그인/회원가입 페이지 테스트
 * 폼 렌더링, 탭 전환, validation, 리다이렉트, 에러 처리를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import LoginPage from '../LoginPage'

/**
 * addToast 모킹 함수
 */
let mockAddToast: ReturnType<typeof vi.fn>

/**
 * login, register 모킹 함수
 */
let mockLogin: ReturnType<typeof vi.fn>
let mockRegister: ReturnType<typeof vi.fn>

/**
 * 로그인된 사용자 모킹용 변수 (null이면 미로그인)
 */
let mockUser: import('../../types').User | null = null

/**
 * useToast 훅 모킹
 */
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

/**
 * useAuth 훅 모킹 — mockUser 변수를 통해 로그인 상태 전환 가능
 */
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    get user() { return mockUser },
    loading: false,
    login: (...args: unknown[]) => (mockLogin as (...args: unknown[]) => unknown)(...args),
    register: (...args: unknown[]) => (mockRegister as (...args: unknown[]) => unknown)(...args),
    logout: vi.fn(),
  }),
}))

/**
 * LoginPage를 MemoryRouter로 감싸서 렌더링
 */
function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

/**
 * 폼의 submit 버튼(type="submit")을 반환하는 헬퍼
 * 탭 버튼(type="button")과 구분하기 위해 사용
 */
function getSubmitButton(): HTMLButtonElement {
  const form = document.querySelector('form')!
  return within(form).getByRole('button') as HTMLButtonElement
}

beforeEach(() => {
  mockAddToast = vi.fn()
  mockLogin = vi.fn().mockResolvedValue(undefined)
  mockRegister = vi.fn().mockResolvedValue(undefined)
  mockUser = null
})

describe('LoginPage', () => {
  describe('기본 렌더링', () => {
    it('기본적으로 로그인 탭이 활성화되어 사용자명/비밀번호 필드를 표시한다', () => {
      renderLoginPage()

      expect(screen.getByLabelText('사용자명')).toBeInTheDocument()
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
      // 로그인 탭이 기본이므로 이메일 필드는 없어야 함
      expect(screen.queryByLabelText(/이메일/)).not.toBeInTheDocument()
    })

    it('포도가계부 로고와 서브타이틀을 표시한다', () => {
      renderLoginPage()

      expect(screen.getByText(/포도가계부/)).toBeInTheDocument()
      expect(screen.getByText('부부가 함께 쓰는 AI 가계부')).toBeInTheDocument()
    })

    it('"비밀번호를 잊으셨나요?" 링크를 표시한다', () => {
      renderLoginPage()

      const link = screen.getByText('비밀번호를 잊으셨나요?')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/forgot-password')
    })

    it('로그인 submit 버튼을 표시한다', () => {
      renderLoginPage()

      const submitBtn = getSubmitButton()
      expect(submitBtn).toBeInTheDocument()
      expect(submitBtn).toHaveTextContent('로그인')
    })
  })

  describe('탭 전환', () => {
    it('회원가입 탭을 클릭하면 이메일 필드와 약관 체크박스를 표시한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      // 탭 영역의 "회원가입" 버튼 클릭 (첫 번째)
      const registerButtons = screen.getAllByRole('button', { name: '회원가입' })
      await user.click(registerButtons[0])

      // 이메일 필드 확인
      expect(screen.getByLabelText(/이메일/)).toBeInTheDocument()
      // 약관 체크박스 확인
      expect(screen.getByLabelText(/이용약관/)).toBeInTheDocument()
      expect(screen.getByLabelText(/개인정보처리방침/)).toBeInTheDocument()
    })

    it('회원가입 탭에서 로그인 탭으로 돌아오면 이메일 필드가 사라진다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      // 회원가입 탭으로 전환
      const registerButtons = screen.getAllByRole('button', { name: '회원가입' })
      await user.click(registerButtons[0])

      expect(screen.getByLabelText(/이메일/)).toBeInTheDocument()

      // 다시 로그인 탭으로 전환 (탭 버튼 중 첫 번째)
      const loginButtons = screen.getAllByRole('button', { name: '로그인' })
      await user.click(loginButtons[0])

      expect(screen.queryByLabelText(/이메일/)).not.toBeInTheDocument()
    })
  })

  describe('폼 Validation', () => {
    it('사용자명이 3자 미만이면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'ab')
      await user.type(passwordInput, '12345678')

      await user.click(getSubmitButton())

      expect(screen.getByText('사용자명은 3자 이상이어야 합니다')).toBeInTheDocument()
    })

    it('비밀번호가 8자 미만이면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, '1234567')

      await user.click(getSubmitButton())

      expect(screen.getByText('비밀번호는 8자 이상이어야 합니다')).toBeInTheDocument()
    })

    it('사용자명과 비밀번호 모두 짧으면 두 에러를 모두 표시한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'ab')
      await user.type(passwordInput, '1234')

      await user.click(getSubmitButton())

      expect(screen.getByText('사용자명은 3자 이상이어야 합니다')).toBeInTheDocument()
      expect(screen.getByText('비밀번호는 8자 이상이어야 합니다')).toBeInTheDocument()
    })
  })

  describe('회원가입 약관 동의', () => {
    it('약관에 동의하지 않으면 회원가입 버튼이 비활성화된다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      // 회원가입 탭 전환
      const registerButtons = screen.getAllByRole('button', { name: '회원가입' })
      await user.click(registerButtons[0])

      const submitBtn = getSubmitButton()
      expect(submitBtn).toBeDisabled()
    })

    it('이용약관만 동의하면 회원가입 버튼이 여전히 비활성화된다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const registerButtons = screen.getAllByRole('button', { name: '회원가입' })
      await user.click(registerButtons[0])

      const termsCheckbox = screen.getByLabelText(/이용약관/)
      await user.click(termsCheckbox)

      const submitBtn = getSubmitButton()
      expect(submitBtn).toBeDisabled()
    })

    it('이용약관과 개인정보처리방침 모두 동의하면 회원가입 버튼이 활성화된다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const registerButtons = screen.getAllByRole('button', { name: '회원가입' })
      await user.click(registerButtons[0])

      const termsCheckbox = screen.getByLabelText(/이용약관/)
      const privacyCheckbox = screen.getByLabelText(/개인정보처리방침/)

      await user.click(termsCheckbox)
      await user.click(privacyCheckbox)

      const submitBtn = getSubmitButton()
      expect(submitBtn).not.toBeDisabled()
    })
  })

  describe('폼 제출', () => {
    it('올바른 정보로 로그인 폼을 제출하면 login 함수를 호출한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'password123')

      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123', // pragma: allowlist secret
        })
      })
    })

    it('로그인 성공 시 성공 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'password123')

      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '로그인되었습니다')
      })
    })

    it('로그인 실패 시 에러 토스트를 표시한다', async () => {
      mockLogin.mockRejectedValueOnce({
        response: { data: { detail: '잘못된 사용자명 또는 비밀번호입니다' } },
      })

      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'wrongpassword')

      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '잘못된 사용자명 또는 비밀번호입니다')
      })
    })

    it('로그인 실패 시 API 응답에 detail이 없으면 기본 에러 메시지를 표시한다', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Network error'))

      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'password123')

      await user.click(getSubmitButton())

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '로그인에 실패했습니다')
      })
    })

    it('제출 중에는 "처리 중..." 텍스트와 로딩 상태를 표시한다', async () => {
      // login이 resolve되기 전까지 대기하도록 설정
      let resolveLogin: () => void
      mockLogin.mockImplementation(
        () => new Promise<void>((resolve) => { resolveLogin = resolve })
      )

      const user = userEvent.setup()
      renderLoginPage()

      const usernameInput = screen.getByLabelText('사용자명')
      const passwordInput = screen.getByLabelText('비밀번호')

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'password123')

      await user.click(getSubmitButton())

      // 로딩 중 "처리 중..." 텍스트 표시 확인
      await waitFor(() => {
        expect(screen.getByText('처리 중...')).toBeInTheDocument()
      })

      // submit 버튼이 disabled 상태인지 확인
      const loadingButton = screen.getByText('처리 중...').closest('button')
      expect(loadingButton).toBeDisabled()

      // login 완료
      resolveLogin!()
    })
  })
})

describe('LoginPage - 로그인된 사용자 리다이렉트', () => {
  it('이미 로그인된 사용자는 "/"로 리다이렉트된다', () => {
    // mockUser를 설정하여 로그인 상태를 시뮬레이션
    mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    // Navigate 컴포넌트가 렌더링되므로 로그인 폼이 보이지 않아야 함
    expect(screen.queryByLabelText('사용자명')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument()
  })
})
