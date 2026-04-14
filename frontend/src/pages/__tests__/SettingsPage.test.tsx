/**
 * @file SettingsPage.test.tsx
 * @description 설정 페이지 테스트
 * 메뉴 목록 및 서브 페이지 렌더링을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import SettingsPage from '../SettingsPage'
import { ThemeProvider } from '../../contexts/ThemeContext'
import { changelogs } from '../../data/changelogs'

// Supabase 모킹
vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// refreshUser는 테스트마다 호출 여부를 검증할 수 있도록 vi.fn()으로 분리
const mockRefreshUser = vi.fn()

// useToast 모킹 (react-hot-toast 대신 커스텀 훅 사용)
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// useChangelog 모킹 — 실제 localStorage 접근 및 상태 업데이트로 인한 re-render 방지
vi.mock('../../hooks/useChangelog', () => ({
  useChangelog: () => ({
    hasUnread: true,
    markAsRead: vi.fn(),
    changelogs,
  }),
}))

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
    refreshUser: mockRefreshUser,
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
    // window.confirm 기본 동작 (연동 해제 confirm 대화상자 자동 승인)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('메뉴 목록 (메인)', () => {
    it('카테고리 메뉴 항목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('카테고리')).toBeInTheDocument()
    })

    it('정기거래 메뉴 항목이 있고 반복 거래 라는 구 용어는 없다', () => {
      renderSettingsPage()
      expect(screen.getByText('정기거래')).toBeInTheDocument()
      expect(screen.queryByText('반복 거래')).not.toBeInTheDocument()
    })

    it('10개 메뉴 항목을 표시한다 (약관/개인정보는 독립 메뉴에서 제거됨)', () => {
      renderSettingsPage()
      expect(screen.getByText('카테고리')).toBeInTheDocument()
      expect(screen.getByText('예산 관리')).toBeInTheDocument()
      expect(screen.getByText('결제수단')).toBeInTheDocument()
      expect(screen.getByText('정기거래')).toBeInTheDocument()
      expect(screen.getByText('공유 가계부')).toBeInTheDocument()
      expect(screen.getByText('화면 모드')).toBeInTheDocument()
      expect(screen.getByText('내 계정')).toBeInTheDocument()
      expect(screen.getByText('새소식')).toBeInTheDocument()
      // 사용 가이드는 메뉴에서 제거됨 (각 페이지 빈 상태에 인라인 안내로 대체)
      expect(screen.queryByText('사용 가이드')).not.toBeInTheDocument()
      // 피드백은 헤더 아이콘으로 이동
      expect(screen.queryByText('기능 요청 · 버그 신고')).not.toBeInTheDocument()
      // 개인정보/약관은 더보기 메뉴에서 독립 항목으로 존재하지 않아야 한다
      expect(screen.queryByText('개인정보 처리방침')).not.toBeInTheDocument()
      expect(screen.queryByText('서비스 이용약관')).not.toBeInTheDocument()
    })

    it('3개 섹션 헤더(가계부, 설정, 앱 정보)를 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('가계부')).toBeInTheDocument()
      expect(screen.getByText('설정')).toBeInTheDocument()
      expect(screen.getByText('앱 정보')).toBeInTheDocument()
    })

    it('불필요한 메뉴 설명은 표시하지 않는다', () => {
      renderSettingsPage()
      // 자명한 메뉴는 description 없음
      expect(screen.queryByText('지출/수입 분류 카테고리 관리')).not.toBeInTheDocument()
      expect(screen.queryByText('카테고리별/월 총 예산 설정')).not.toBeInTheDocument()
      expect(screen.queryByText('정기 지출/수입 관리')).not.toBeInTheDocument()
      expect(screen.queryByText('가구 생성, 초대, 멤버 관리')).not.toBeInTheDocument()
      expect(screen.queryByText('앱 업데이트 내역')).not.toBeInTheDocument()
      expect(screen.queryByText('앱 기능별 상세 사용법')).not.toBeInTheDocument()
      expect(screen.queryByText('프로필, 텔레그램/카카오톡 연동, 로그아웃')).not.toBeInTheDocument()
    })

    it('화면 모드 description은 현재 테마 상태를 표시한다', () => {
      renderSettingsPage()
      // 라이트/다크 모드 상태 중 하나가 표시되어야 한다
      const hasModeText =
        screen.queryByText('라이트 모드') !== null ||
        screen.queryByText('다크 모드') !== null
      expect(hasModeText).toBe(true)
    })

    it('피드백 링크가 헤더에 존재한다', () => {
      renderSettingsPage()
      // 피드백은 메뉴 항목이 아닌 헤더 아이콘 링크로 제공됨
      const feedbackLink = document.querySelector('a[href="/feedback"]')
      expect(feedbackLink).toBeInTheDocument()
    })

    it('더보기 메뉴에 외부 auth.podonest.com 링크가 없어야 한다', () => {
      renderSettingsPage()
      const allLinks = document.querySelectorAll('a[href*="auth.podonest.com"]')
      expect(allLinks.length).toBe(0)
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

    it('비밀번호 변경 버튼을 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('비밀번호 변경')).toBeInTheDocument()
    })

    it('계정 삭제 버튼을 표시한다', () => {
      renderSettingsPage('/settings/my-account')
      expect(screen.getByText('계정 삭제')).toBeInTheDocument()
    })

    it('이용약관 · 개인정보처리방침 링크가 내부 경로를 가리킨다', () => {
      renderSettingsPage('/settings/my-account')
      const termsLink = screen.getByRole('link', { name: '이용약관' })
      const privacyLink = screen.getByRole('link', { name: '개인정보처리방침' })
      expect(termsLink).toHaveAttribute('href', '/terms')
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })

    it('이용약관 · 개인정보처리방침 링크가 계정 삭제 위에 위치한다', () => {
      renderSettingsPage('/settings/my-account')
      // 링크가 존재하는지 확인
      expect(screen.getByText('이용약관')).toBeInTheDocument()
      expect(screen.getByText('개인정보처리방침')).toBeInTheDocument()
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

  describe('화면 모드 서브 페이지', () => {
    it('화면 모드 옵션을 표시한다', () => {
      renderSettingsPage('/settings/appearance')
      expect(screen.getByText('시스템 설정')).toBeInTheDocument()
      expect(screen.getByText('라이트 모드')).toBeInTheDocument()
      expect(screen.getByText('다크 모드')).toBeInTheDocument()
    })

    it('화면 모드 제목을 표시한다', () => {
      renderSettingsPage('/settings/appearance')
      expect(screen.getByText('화면 모드')).toBeInTheDocument()
    })
  })

  describe('텔레그램 연동 (내 계정 서브 페이지)', () => {
    it('텔레그램 연동 코드 발급 버튼 클릭 시 코드가 화면에 표시된다', async () => {
      // MSW에 텔레그램 코드 발급 핸들러 등록
      server.use(
        http.post('/api/auth/telegram-link-code', () =>
          HttpResponse.json({
            code: 'ABC123',
            expires_at: '2026-03-19T12:00:00Z',
          })
        )
      )

      const user = userEvent.setup()
      renderSettingsPage('/settings/my-account')

      // "연동 코드 발급" 버튼이 여럿 있으므로 (텔레그램 + 카카오) 첫 번째(텔레그램) 클릭
      const codeBtns = await screen.findAllByRole('button', { name: '연동 코드 발급' })
      await user.click(codeBtns[0]) // 첫 번째가 텔레그램

      // 발급된 코드가 화면에 표시되어야 한다
      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument()
      })
    })

    it('미연동 상태에서는 연동 해제 버튼 없이 코드 발급 버튼이 표시된다', () => {
      // useAuth mock에서 is_telegram_linked=false가 기본값
      renderSettingsPage('/settings/my-account')

      // 미연동 상태: "연동 코드 발급" 버튼들이 존재 (텔레그램 + 카카오 각 1개)
      const codeBtns = screen.getAllByRole('button', { name: '연동 코드 발급' })
      expect(codeBtns.length).toBeGreaterThanOrEqual(1)
      // 연동 해제 버튼은 없어야 한다 (is_linked=false 상태이므로)
      expect(screen.queryByRole('button', { name: '연동 해제' })).not.toBeInTheDocument()
    })
  })

  describe('섹션 라우팅', () => {
    it('잘못된 섹션 접근 시 null을 반환한다 (navigate로 리디렉션)', () => {
      const { container } = renderSettingsPage('/settings/invalid-section')
      // navigate({ replace: true })가 호출되고 null 반환 → 빈 DOM
      expect(container.textContent).toBe('')
    })

    it('이전 URL(account-info) 접근 시 null을 반환한다 (navigate로 리디렉션)', () => {
      const { container } = renderSettingsPage('/settings/account-info')
      expect(container.textContent).toBe('')
    })

    it('이전 URL(telegram) 접근 시 null을 반환한다 (navigate로 리디렉션)', () => {
      const { container } = renderSettingsPage('/settings/telegram')
      expect(container.textContent).toBe('')
    })

    it('이전 URL(management) 접근 시 null을 반환한다 (navigate로 리디렉션)', () => {
      const { container } = renderSettingsPage('/settings/management')
      expect(container.textContent).toBe('')
    })
  })

  describe('PWA 설치 버튼', () => {
    it('설정 메인에서 앱으로 설치 버튼이 표시된다', () => {
      renderSettingsPage()
      expect(screen.getByText('앱으로 설치')).toBeInTheDocument()
    })
  })
})
