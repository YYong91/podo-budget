/**
 * @file Layout.test.tsx
 * @description Layout 컴포넌트 테스트
 * 헤더, 사이드바, 네비게이션 항목, 반응형 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Layout from '../Layout'

/**
 * useAuth 훅 모킹
 */
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', email: null, is_active: true, created_at: '2024-01-01' },
    logout: vi.fn(),
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
  }),
}))

/**
 * useHouseholdStore 훅 모킹
 */
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    households: [],
    activeHouseholdId: null,
    myInvitations: [],
    fetchHouseholds: vi.fn().mockResolvedValue(undefined),
    fetchMyInvitations: vi.fn().mockResolvedValue(undefined),
    setActiveHouseholdId: vi.fn(),
  }),
}))

/**
 * Layout 컴포넌트를 MemoryRouter로 감싸서 렌더링하는 헬퍼 함수
 */
function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Layout />
    </MemoryRouter>
  )
}

describe('Layout', () => {
  describe('헤더 렌더링', () => {
    it('로고를 표시한다', () => {
      renderLayout()
      // 모바일 헤더 + 데스크톱 사이드바 타이틀 두 곳에 표시됨
      expect(screen.getAllByText(/포도가계부/).length).toBeGreaterThan(0)
    })

    it('모바일 메뉴 버튼을 표시한다', () => {
      renderLayout()
      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      expect(menuButton).toBeInTheDocument()
    })
  })

  describe('사이드바 네비게이션', () => {
    it('모든 네비게이션 항목을 표시한다', () => {
      renderLayout()
      expect(screen.getByRole('link', { name: /대시보드/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /지출 목록/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /카테고리/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /리포트/i })).toBeInTheDocument()
    })

    it('현재 경로에 해당하는 네비게이션 항목에 aria-current를 설정한다', () => {
      renderLayout('/')
      const dashboardLink = screen.getByRole('link', { name: /대시보드/i })
      expect(dashboardLink).toHaveAttribute('aria-current', 'page')
    })

    it('다른 경로의 네비게이션 항목에는 aria-current가 없다', () => {
      renderLayout('/')
      const expenseLink = screen.getByRole('link', { name: /지출 목록/i })
      expect(expenseLink).not.toHaveAttribute('aria-current')
    })
  })

  describe('사이드바 토글 동작', () => {
    it('모바일 메뉴 버튼을 클릭하면 오버레이가 표시된다', async () => {
      const user = userEvent.setup()
      renderLayout()

      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      await user.click(menuButton)

      expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument()
    })

    it('오버레이를 클릭하면 사이드바가 닫힌다', async () => {
      const user = userEvent.setup()
      renderLayout()

      // 사이드바 열기
      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      await user.click(menuButton)

      const overlay = screen.getByTestId('sidebar-overlay')
      expect(overlay).toBeInTheDocument()
      await user.click(overlay)

      // 오버레이가 사라졌는지 확인
      expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument()
    })

    it('네비게이션 링크를 클릭하면 사이드바가 닫힌다', async () => {
      const user = userEvent.setup()
      renderLayout()

      // 사이드바 열기
      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      await user.click(menuButton)

      // 네비게이션 링크 클릭
      const expenseLink = screen.getByRole('link', { name: /지출 목록/i })
      await user.click(expenseLink)

      // 오버레이가 사라졌는지 확인
      expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument()
    })
  })

  describe('반응형 동작', () => {
    it('사이드바 aside 요소가 존재한다', () => {
      renderLayout()
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })
  })

  describe('아웃렛 렌더링', () => {
    it('Outlet을 통해 하위 페이지가 렌더링된다', () => {
      renderLayout()
      expect(screen.getByRole('main')).toBeInTheDocument()
    })
  })
})
