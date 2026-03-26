/**
 * @file LoginPage.test.tsx
 * @description 로그인/회원가입 페이지 테스트 — 약관 동의, 인증 플로우, 에러 처리, 모드 전환
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'

// Supabase 모킹
const mockSignUp = vi.fn().mockResolvedValue({ error: null })
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null })
const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null })
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

// useNavigate 모킹
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

function switchToSignup() {
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
}

function switchToReset() {
  fireEvent.click(screen.getByRole('button', { name: '비밀번호를 잊으셨나요?' }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe('기본 렌더링', () => {
    it('로고와 타이틀을 표시한다', () => {
      renderPage()
      expect(screen.getByText('포도가계부')).toBeInTheDocument()
      expect(screen.getByText('AI가 알아서 정리해주는 똑똑한 가계부')).toBeInTheDocument()
    })

    it('Google 소셜 로그인 버튼을 표시한다', () => {
      renderPage()
      expect(screen.getByText('Google로 계속하기')).toBeInTheDocument()
    })

    it('이메일/비밀번호 입력 필드를 표시한다', () => {
      renderPage()
      expect(screen.getByLabelText('이메일')).toBeInTheDocument()
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    })

    it('로그인 버튼을 표시한다', () => {
      renderPage()
      expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    })

    it('비밀번호 찾기 버튼을 표시한다', () => {
      renderPage()
      expect(screen.getByRole('button', { name: '비밀번호를 잊으셨나요?' })).toBeInTheDocument()
    })

    it('회원가입 전환 버튼을 표시한다', () => {
      renderPage()
      expect(screen.getByText('계정이 없으신가요?')).toBeInTheDocument()
    })
  })

  describe('소셜 로그인 약관 안내', () => {
    it('소셜 로그인 버튼 영역에 약관 동의 안내 문구를 표시한다', () => {
      renderPage()
      expect(screen.getByText(/이용약관/)).toBeInTheDocument()
      expect(screen.getByText(/개인정보처리방침/)).toBeInTheDocument()
    })

    it('이용약관 링크가 /terms로 연결된다', () => {
      renderPage()
      const termsLink = screen.getByRole('link', { name: '이용약관' })
      expect(termsLink).toHaveAttribute('href', '/terms')
    })

    it('개인정보처리방침 링크가 /privacy로 연결된다', () => {
      renderPage()
      const privacyLink = screen.getByRole('link', { name: '개인정보처리방침' })
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })
  })

  describe('이메일 회원가입 약관 동의', () => {
    it('회원가입 모드에서 약관 동의 체크박스를 표시한다', () => {
      renderPage()
      switchToSignup()
      expect(screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })).toBeInTheDocument()
    })

    it('약관 동의 체크하지 않으면 회원가입 버튼이 비활성화된다', () => {
      renderPage()
      switchToSignup()
      const submitButton = screen.getByRole('button', { name: '회원가입' })
      expect(submitButton).toBeDisabled()
    })

    it('약관 동의 체크하면 회원가입 버튼이 활성화된다', () => {
      renderPage()
      switchToSignup()
      const checkbox = screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })
      fireEvent.click(checkbox)
      const submitButton = screen.getByRole('button', { name: '회원가입' })
      expect(submitButton).not.toBeDisabled()
    })

    it('로그인 모드에서는 약관 동의 체크박스를 표시하지 않는다', () => {
      renderPage()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('모드 전환 시 약관 동의가 초기화된다', () => {
      renderPage()
      switchToSignup()
      const checkbox = screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      fireEvent.click(screen.getByRole('button', { name: '로그인' }))
      switchToSignup()
      const resetCheckbox = screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })
      expect(resetCheckbox).not.toBeChecked()
    })

    it('회원가입 모드에서 이름 필드를 표시한다', () => {
      renderPage()
      switchToSignup()
      expect(screen.getByLabelText('이름')).toBeInTheDocument()
    })
  })

  describe('이메일 로그인', () => {
    it('로그인 성공 시 홈으로 이동한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password123')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'test@test.com',
          password: 'password123',
        })
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })

    it('로그인 성공 시 intended_path로 이동한다', async () => {
      sessionStorage.setItem('intended_path', '/settings')
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password123')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/settings', { replace: true })
      })
      // intended_path가 sessionStorage에서 제거됨
      expect(sessionStorage.getItem('intended_path')).toBeNull()
    })

    it('잘못된 자격증명 에러 메시지를 표시한다', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: new Error('Invalid login credentials'),
      })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'wrong')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
      })
    })

    it('rate limit 에러를 처리한다', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: new Error('rate limit exceeded'),
      })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(screen.getByText('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument()
      })
    })

    it('알 수 없는 에러 메시지를 표시한다', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: new Error('Some unknown error'),
      })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(screen.getByText('Some unknown error')).toBeInTheDocument()
      })
    })

    it('로딩 중 버튼 텍스트가 변경된다', async () => {
      // signIn이 resolve되지 않는 상태 유지
      mockSignInWithPassword.mockReturnValueOnce(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password')
      await user.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '처리 중...' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '처리 중...' })).toBeDisabled()
      })
    })
  })

  describe('이메일 회원가입', () => {
    it('회원가입 성공 시 navigate를 호출한다', async () => {
      const user = userEvent.setup()
      renderPage()
      switchToSignup()

      await user.type(screen.getByLabelText('이름'), '홍길동')
      await user.type(screen.getByLabelText('이메일'), 'new@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password123')
      fireEvent.click(screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ }))
      await user.click(screen.getByRole('button', { name: '회원가입' }))

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'new@test.com',
          password: 'password123',
          options: { data: { name: '홍길동' } },
        })
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })

    it('이미 가입된 이메일 에러를 표시한다', async () => {
      mockSignUp.mockResolvedValueOnce({
        error: new Error('User already registered'),
      })
      const user = userEvent.setup()
      renderPage()
      switchToSignup()

      await user.type(screen.getByLabelText('이름'), '홍길동')
      await user.type(screen.getByLabelText('이메일'), 'exists@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password123')
      fireEvent.click(screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ }))
      await user.click(screen.getByRole('button', { name: '회원가입' }))

      await waitFor(() => {
        expect(screen.getByText('이미 가입된 이메일입니다')).toBeInTheDocument()
      })
    })

    it('짧은 비밀번호 에러를 표시한다', async () => {
      mockSignUp.mockResolvedValueOnce({
        error: new Error('Password should be at least 6 characters'),
      })
      const user = userEvent.setup()
      renderPage()
      switchToSignup()

      await user.type(screen.getByLabelText('이름'), '홍길동')
      await user.type(screen.getByLabelText('이메일'), 'new@test.com')
      await user.type(screen.getByLabelText('비밀번호'), '12345')
      fireEvent.click(screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ }))
      await user.click(screen.getByRole('button', { name: '회원가입' }))

      await waitFor(() => {
        expect(screen.getByText('비밀번호는 6자 이상이어야 합니다')).toBeInTheDocument()
      })
    })
  })

  describe('Google OAuth 로그인', () => {
    it('Google 로그인 버튼 클릭 시 OAuth를 호출한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('Google로 계속하기'))

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      })
    })

    it('Google 로그인 에러 시 에러 메시지를 표시한다', async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        error: { message: 'OAuth 연동 실패' },
      })
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('Google로 계속하기'))

      await waitFor(() => {
        expect(screen.getByText('OAuth 연동 실패')).toBeInTheDocument()
      })
    })

    it('Google 로그인 에러 메시지 없을 때 기본 메시지를 표시한다', async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        error: { message: '' },
      })
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('Google로 계속하기'))

      await waitFor(() => {
        expect(screen.getByText('Google 로그인에 실패했습니다')).toBeInTheDocument()
      })
    })
  })

  describe('비밀번호 재설정 모드', () => {
    it('비밀번호 찾기 클릭 시 reset 모드로 전환한다', () => {
      renderPage()
      switchToReset()

      // 비밀번호 필드가 숨겨진다
      expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument()
      // 재설정 버튼이 표시된다
      expect(screen.getByRole('button', { name: '재설정 메일 보내기' })).toBeInTheDocument()
    })

    it('재설정 성공 시 성공 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderPage()
      switchToReset()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 메일 보내기' }))

      await waitFor(() => {
        expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@test.com', {
          redirectTo: expect.stringContaining('/auth/callback'),
        })
        expect(screen.getByText('비밀번호 재설정 메일을 발송했습니다. 이메일을 확인해주세요.')).toBeInTheDocument()
      })
    })

    it('재설정 에러 시 에러 메시지를 표시한다', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        error: new Error('Reset failed'),
      })
      const user = userEvent.setup()
      renderPage()
      switchToReset()

      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 메일 보내기' }))

      await waitFor(() => {
        expect(screen.getByText('Reset failed')).toBeInTheDocument()
      })
    })

    it('reset 모드에서 로그인 모드로 전환할 수 있다', () => {
      renderPage()
      switchToReset()
      expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '로그인' }))
      expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    })

    it('reset 모드에서 비밀번호 찾기 버튼이 표시되지 않는다', () => {
      renderPage()
      switchToReset()
      expect(screen.queryByText('비밀번호를 잊으셨나요?')).not.toBeInTheDocument()
    })
  })

  describe('모드 전환', () => {
    it('회원가입 → 로그인 전환 시 에러/성공 메시지가 초기화된다', async () => {
      mockSignUp.mockResolvedValueOnce({
        error: new Error('User already registered'),
      })
      const user = userEvent.setup()
      renderPage()
      switchToSignup()

      await user.type(screen.getByLabelText('이름'), '홍길동')
      await user.type(screen.getByLabelText('이메일'), 'test@test.com')
      await user.type(screen.getByLabelText('비밀번호'), 'password')
      fireEvent.click(screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ }))
      await user.click(screen.getByRole('button', { name: '회원가입' }))

      await waitFor(() => {
        expect(screen.getByText('이미 가입된 이메일입니다')).toBeInTheDocument()
      })

      // 로그인 모드로 전환 → 에러 메시지 초기화
      fireEvent.click(screen.getByRole('button', { name: '로그인' }))
      expect(screen.queryByText('이미 가입된 이메일입니다')).not.toBeInTheDocument()
    })
  })
})
