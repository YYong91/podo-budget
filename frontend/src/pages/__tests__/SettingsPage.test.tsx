/**
 * @file SettingsPage.test.tsx
 * @description 설정 페이지 테스트
 * 사용자 정보 표시 및 계정 관리 안내를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../SettingsPage'

// useAuth 모킹
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
    loading: false,
  }),
}))

function renderSettingsPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('기본 렌더링', () => {
    it('페이지 제목 "설정"을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    })

    it('계정 정보 섹션 제목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('계정 정보')).toBeInTheDocument()
    })
  })

  describe('사용자 정보 표시', () => {
    it('사용자명을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('사용자명')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('이메일을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('이메일')).toBeInTheDocument()
      expect(screen.getByText('test@test.com')).toBeInTheDocument()
    })

    it('가입일을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('가입일')).toBeInTheDocument()
      expect(screen.getByText('2024.01.15')).toBeInTheDocument()
    })
  })

  describe('계정 관리 안내', () => {
    it('계정 관리 섹션을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('계정 관리')).toBeInTheDocument()
    })

    it('podo-auth 안내 문구를 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText(/포도 통합 계정/)).toBeInTheDocument()
    })
  })
})
