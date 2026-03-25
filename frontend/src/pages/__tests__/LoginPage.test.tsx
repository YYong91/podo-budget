/**
 * @file LoginPage.test.tsx
 * @description 로그인/회원가입 페이지 테스트 — 약관 동의 플로우 (#409)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'

// Supabase 모킹
vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      // 회원가입 모드로 전환
      switchToSignup()
      // 체크박스 체크
      const checkbox = screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      // 로그인 모드로 전환 후 다시 회원가입
      fireEvent.click(screen.getByRole('button', { name: '로그인' }))
      switchToSignup()
      // 체크박스가 초기화되어야 함
      const resetCheckbox = screen.getByRole('checkbox', { name: /이용약관.*개인정보처리방침.*동의/ })
      expect(resetCheckbox).not.toBeChecked()
    })
  })
})
