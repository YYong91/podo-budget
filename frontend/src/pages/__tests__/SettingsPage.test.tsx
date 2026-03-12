/**
 * @file SettingsPage.test.tsx
 * @description 설정 페이지 테스트
 * 사용자 정보 표시 및 계정 관리 안내를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../SettingsPage'
import { changelogs } from '../../data/changelogs'

// useAuth 모킹
vi.mock('../../contexts/AuthContext', () => ({
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
  }),
}))

// IntersectionObserver 모킹
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
} as unknown as typeof globalThis.IntersectionObserver

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
    localStorage.clear()
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
      expect(screen.getAllByText(/포도 통합 계정/).length).toBeGreaterThan(0)
    })
  })

  describe('새소식 섹션', () => {
    it('새소식 제목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('새소식')).toBeInTheDocument()
    })

    it('changelog 항목의 버전과 제목을 표시한다', () => {
      renderSettingsPage()
      changelogs.forEach((log) => {
        expect(screen.getByText(`v${log.version}`)).toBeInTheDocument()
        expect(screen.getByText(log.title)).toBeInTheDocument()
      })
    })

    it('미확인 업데이트가 있으면 "새 업데이트" 뱃지를 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('새 업데이트')).toBeInTheDocument()
    })

    it('이미 확인한 버전이면 "새 업데이트" 뱃지가 없다', () => {
      localStorage.setItem('podo-changelog-last-seen', changelogs[0].version)
      renderSettingsPage()
      expect(screen.queryByText('새 업데이트')).not.toBeInTheDocument()
    })

    it('태그(신규/개선/수정)를 표시한다', () => {
      renderSettingsPage()
      // 첫 번째 changelog의 첫 번째 아이템 태그 확인
      const firstTag = changelogs[0].items[0].tag
      expect(screen.getAllByText(firstTag).length).toBeGreaterThan(0)
    })
  })
})
