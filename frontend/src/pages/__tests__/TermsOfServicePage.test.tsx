/**
 * @file TermsOfServicePage.test.tsx
 * @description 이용약관 페이지 스냅샷 테스트
 * 정적 콘텐츠 페이지이므로 스냅샷으로 변경을 감지한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsOfServicePage from '../TermsOfServicePage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TermsOfServicePage />
    </MemoryRouter>,
  )
}

describe('TermsOfServicePage', () => {
  it('페이지 제목을 표시한다', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '이용약관' })).toBeInTheDocument()
  })

  it('주요 조항 제목을 모두 포함한다', () => {
    renderPage()
    expect(screen.getByText('제1조 (목적)')).toBeInTheDocument()
    expect(screen.getByText('제2조 (서비스의 내용)')).toBeInTheDocument()
    expect(screen.getByText('제3조 (회원가입 및 계정 관리)')).toBeInTheDocument()
    expect(screen.getByText('제4조 (이용자의 의무)')).toBeInTheDocument()
    expect(screen.getByText('제5조 (서비스 제공자의 의무 및 책임 제한)')).toBeInTheDocument()
    expect(screen.getByText('제6조 (서비스의 변경 및 중단)')).toBeInTheDocument()
    expect(screen.getByText('제7조 (지적재산권)')).toBeInTheDocument()
    expect(screen.getByText('제8조 (면책 조항)')).toBeInTheDocument()
    expect(screen.getByText('제9조 (회원 탈퇴 및 계정 삭제)')).toBeInTheDocument()
    expect(screen.getByText('제10조 (약관의 변경)')).toBeInTheDocument()
    expect(screen.getByText('제11조 (준거법 및 관할)')).toBeInTheDocument()
  })

  it('시행일자를 표시한다', () => {
    renderPage()
    expect(screen.getByText(/2026년 2월 13일/)).toBeInTheDocument()
  })

  it('로그인 페이지로 돌아가기 링크를 표시한다', () => {
    renderPage()
    const backLink = screen.getByRole('link', { name: /로그인으로 돌아가기/ })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/login')
  })

  it('포도가계부 로고 링크를 표시한다', () => {
    renderPage()
    const logoLink = screen.getByRole('link', { name: '포도가계부' })
    expect(logoLink).toBeInTheDocument()
    expect(logoLink).toHaveAttribute('href', '/login')
  })

  it('스냅샷과 일치한다', () => {
    const { container } = renderPage()
    expect(container).toMatchSnapshot()
  })
})
