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
    it('헤더에 로고를 표시한다', () => {
      renderLayout()
      expect(screen.getByText('HomeNRich')).toBeInTheDocument()
    })

    it('헤더에 부제목을 표시한다', () => {
      renderLayout()
      expect(screen.getByText('가계부')).toBeInTheDocument()
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

    it('현재 경로에 해당하는 네비게이션 항목에 active 스타일을 적용한다', () => {
      renderLayout('/')
      const dashboardLink = screen.getByRole('link', { name: /대시보드/i })
      expect(dashboardLink).toHaveClass('bg-grape-50', 'text-grape-800')
    })

    it('다른 경로의 네비게이션 항목에는 active 스타일이 없다', () => {
      renderLayout('/')
      const expenseLink = screen.getByRole('link', { name: /지출 목록/i })
      expect(expenseLink).not.toHaveClass('bg-grape-50')
      expect(expenseLink).toHaveClass('text-warm-600')
    })
  })

  describe('사이드바 토글 동작', () => {
    it('모바일 메뉴 버튼을 클릭하면 오버레이가 표시된다', async () => {
      const user = userEvent.setup()
      renderLayout()

      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      await user.click(menuButton)

      // 오버레이가 나타나는지 확인 (bg-black/30 클래스를 가진 div)
      const overlay = document.querySelector('.bg-black\\/30')
      expect(overlay).toBeInTheDocument()
    })

    it('오버레이를 클릭하면 사이드바가 닫힌다', async () => {
      const user = userEvent.setup()
      renderLayout()

      // 사이드바 열기
      const menuButton = screen.getByRole('button', { name: /메뉴 열기/i })
      await user.click(menuButton)

      // 오버레이 클릭
      const overlay = document.querySelector('.bg-black\\/30')
      expect(overlay).toBeInTheDocument()

      if (overlay) {
        await user.click(overlay as HTMLElement)
      }

      // 오버레이가 사라졌는지 확인
      expect(document.querySelector('.bg-black\\/30')).not.toBeInTheDocument()
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
      expect(document.querySelector('.bg-black\\/30')).not.toBeInTheDocument()
    })
  })

  describe('반응형 동작', () => {
    it('사이드바는 translate-x 클래스로 숨김/표시를 제어한다', () => {
      renderLayout()
      const aside = document.querySelector('aside')
      expect(aside).toHaveClass('-translate-x-full', 'md:translate-x-0')
    })
  })

  describe('아웃렛 렌더링', () => {
    it('Outlet을 통해 하위 페이지가 렌더링된다', () => {
      renderLayout()
      // Outlet이 포함된 main 요소가 존재하는지 확인
      const mainElement = document.querySelector('main')
      expect(mainElement).toBeInTheDocument()
    })
  })
})
