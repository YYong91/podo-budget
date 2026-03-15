/**
 * @file SettingsPage.test.tsx
 * @description 설정 페이지 테스트
 * 메뉴 목록 및 서브 페이지 렌더링을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SettingsPage from '../SettingsPage'
import { ThemeProvider } from '../../contexts/ThemeContext'
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
    logout: vi.fn(),
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

function renderSettingsPage(path = '/settings') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('메뉴 목록 (메인)', () => {
    it('카테고리 메뉴 항목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('카테고리')).toBeInTheDocument()
    })

    it('9개 메뉴 항목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('카테고리')).toBeInTheDocument()
      expect(screen.getByText('예산 관리')).toBeInTheDocument()
      expect(screen.getByText('반복 거래')).toBeInTheDocument()
      expect(screen.getByText('공유 가계부')).toBeInTheDocument()
      expect(screen.getByText('화면 모드')).toBeInTheDocument()
      expect(screen.getByText('내 계정')).toBeInTheDocument()
      expect(screen.getByText('새소식')).toBeInTheDocument()
      expect(screen.getByText('사용 가이드')).toBeInTheDocument()
      expect(screen.getByText('피드백')).toBeInTheDocument()
    })

    it('메뉴 설명을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('앱 업데이트 내역')).toBeInTheDocument()
      expect(screen.getByText('프로필, 텔레그램/카카오톡 연동, 로그아웃')).toBeInTheDocument()
      expect(screen.getByText('지출/수입 분류 카테고리 관리')).toBeInTheDocument()
    })
  })

  describe('내 계정 서브 페이지', () => {
    it('기본 정보를 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('기본 정보')).toBeInTheDocument()
      expect(screen.getByText('사용자명')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('이메일을 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('이메일')).toBeInTheDocument()
      expect(screen.getByText('test@test.com')).toBeInTheDocument()
    })

    it('가입일을 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('가입일')).toBeInTheDocument()
      expect(screen.getByText('2024.01.15')).toBeInTheDocument()
    })

    it('연동 서비스 섹션을 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('연동 서비스')).toBeInTheDocument()
      expect(screen.getByText('텔레그램')).toBeInTheDocument()
    })

    it('podo-auth 안내를 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getAllByText(/포도 통합 계정/).length).toBeGreaterThan(0)
    })
  })

  describe('새소식 서브 페이지', () => {
    it('changelog 항목의 버전과 제목을 표시한다', () => {
      renderSettingsPage('/settings/changelog')
      changelogs.forEach((log) => {
        expect(screen.getByText(`v${log.version}`)).toBeInTheDocument()
        expect(screen.getByText(log.title)).toBeInTheDocument()
      })
    })

    it('미확인 업데이트가 있으면 메뉴에 뱃지를 표시한다', () => {
      renderSettingsPage()
      // 메뉴 목록에서 새소식 항목의 unread 뱃지 확인
      expect(screen.getByText('새소식')).toBeInTheDocument()
    })

    it('태그(신규/개선/수정)를 표시한다', () => {
      renderSettingsPage('/settings/changelog')
      const firstTag = changelogs[0].items[0].tag
      expect(screen.getAllByText(firstTag).length).toBeGreaterThan(0)
    })
  })
})
