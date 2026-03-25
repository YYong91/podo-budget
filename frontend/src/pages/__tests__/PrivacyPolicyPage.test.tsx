/**
 * @file PrivacyPolicyPage.test.tsx
 * @description 개인정보처리방침 페이지 스냅샷 테스트
 * 정적 콘텐츠 페이지이므로 스냅샷으로 변경을 감지한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicyPage from '../PrivacyPolicyPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  )
}

describe('PrivacyPolicyPage', () => {
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
