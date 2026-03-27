/**
 * @file PrivacyPolicyPage.test.tsx
 * @description 개인정보처리방침 페이지 테스트
 * 인증 상태에 따라 하단 버튼이 달라지는 것을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicyPage from '../PrivacyPolicyPage'

const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  )
}

describe('PrivacyPolicyPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('페이지 제목을 표시한다', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '개인정보처리방침' })).toBeInTheDocument()
  })

  it('주요 섹션 제목을 모두 포함한다', () => {
    renderPage()
    expect(screen.getByText('1. 개인정보의 수집 항목 및 방법')).toBeInTheDocument()
    expect(screen.getByText('2. 개인정보의 수집 및 이용 목적')).toBeInTheDocument()
    expect(screen.getByText('3. 개인정보의 제3자 제공')).toBeInTheDocument()
    expect(screen.getByText('4. 개인정보의 보유 및 이용 기간')).toBeInTheDocument()
    expect(screen.getByText('5. 개인정보의 파기 절차 및 방법')).toBeInTheDocument()
    expect(screen.getByText('6. 사용자 및 법정대리인의 권리')).toBeInTheDocument()
    expect(screen.getByText('7. 개인정보 보호책임자')).toBeInTheDocument()
    expect(screen.getByText('8. 개인정보처리방침의 변경')).toBeInTheDocument()
  })

  it('시행일자를 표시한다', () => {
    renderPage()
    expect(screen.getByText(/2026년 3월 25일/)).toBeInTheDocument()
  })

  it('미인증 상태에서 로그인 페이지로 돌아가기 링크를 표시한다', () => {
    renderPage()
    const backLink = screen.getByRole('link', { name: /로그인으로 돌아가기/ })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/login')
  })

  it('인증 상태에서 뒤로가기 버튼을 표시한다', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, email: 'test@test.com' } })
    renderPage()
    const backButton = screen.getByRole('button', { name: /뒤로가기/ })
    expect(backButton).toBeInTheDocument()
    expect(screen.queryByText(/로그인으로 돌아가기/)).not.toBeInTheDocument()
  })

  it('포도가계부 로고 링크를 표시한다', () => {
    renderPage()
    const logoLink = screen.getByRole('link', { name: '포도가계부' })
    expect(logoLink).toBeInTheDocument()
    expect(logoLink).toHaveAttribute('href', '/login')
  })
})
