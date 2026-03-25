/**
 * @file Layout.test.tsx
 * @description Layout 컴포넌트 테스트
 * 데스크톱 사이드바, 모바일 하단 탭 바, 네비게이션 항목을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../Layout'
import { changelogs } from '../../data/changelogs'

/**
 * useAuth 훅 모킹
 */
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', email: null, is_active: true, created_at: '2024-01-01', is_telegram_linked: false },
    isAuthenticated: true,
    logout: vi.fn(),
    loading: false,
  }),
}))

/**
 * useHouseholdStore 훅 모킹 — 테스트마다 교체 가능
 */
let householdStoreState: {
  households: Array<{ id: number; name: string }>
  activeHouseholdId: number | null
  myInvitations: Array<{ id: number; status: string }>
  setActiveHouseholdId: ReturnType<typeof vi.fn>
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: object) => unknown) => {
    return selector ? selector(householdStoreState) : householdStoreState
  },
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

const STORAGE_KEY = 'podo-changelog-last-seen'

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear()
    householdStoreState = {
      households: [],
      activeHouseholdId: null,
      myInvitations: [],
      setActiveHouseholdId: vi.fn(),
    }
  })

  describe('헤더 렌더링', () => {
    it('로고를 표시한다', () => {
      renderLayout()
      // 모바일 헤더 + 데스크톱 사이드바 타이틀 두 곳에 표시됨
      expect(screen.getAllByText(/포도가계부/).length).toBeGreaterThan(0)
    })
  })

  describe('네비게이션', () => {
    it('모든 네비게이션 항목을 표시한다 (사이드바 + 하단 탭 바)', () => {
      renderLayout()
      // 데스크톱 사이드바 + 모바일 하단 탭 바에 각각 존재 (4탭)
      expect(screen.getAllByRole('link', { name: '가계부' }).length).toBe(2)
      expect(screen.getAllByRole('link', { name: /돌아보기/i }).length).toBe(2)
      expect(screen.getAllByRole('link', { name: /^자산$/i }).length).toBe(2)
      expect(screen.getAllByRole('link', { name: /더보기/i }).length).toBe(2)
    })

    it('현재 경로에 해당하는 네비게이션 항목에 aria-current를 설정한다', () => {
      renderLayout('/')
      const transactionLinks = screen.getAllByRole('link', { name: '가계부' })
      // 사이드바와 하단 탭 바 모두 aria-current 설정
      transactionLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    })

    it('다른 경로의 네비게이션 항목에는 aria-current가 없다', () => {
      renderLayout('/')
      const reportLinks = screen.getAllByRole('link', { name: /돌아보기/i })
      reportLinks.forEach(link => {
        expect(link).not.toHaveAttribute('aria-current')
      })
    })
  })

  describe('레이아웃 구조', () => {
    it('데스크톱 사이드바 aside 요소가 존재한다', () => {
      renderLayout()
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('Outlet을 통해 하위 페이지가 렌더링된다', () => {
      renderLayout()
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('모바일 하단 탭 바의 navigation이 존재한다', () => {
      renderLayout()
      // 사이드바 nav + 하단 탭 바 nav
      const navs = screen.getAllByRole('navigation')
      expect(navs.length).toBe(2)
    })
  })

  describe('새소식 알림 dot', () => {
    it('미확인 업데이트가 있으면 설정 아이콘에 빨간 점을 표시한다', () => {
      renderLayout()
      const settingsLinks = screen.getAllByRole('link', { name: /더보기/i })
      // 사이드바와 하단 탭 바 모두 빨간 점 표시
      settingsLinks.forEach(link => {
        const dot = link.querySelector('.bg-red-500.rounded-full')
        expect(dot).toBeInTheDocument()
      })
    })

    it('이미 확인한 버전이면 빨간 점이 없다', () => {
      localStorage.setItem(STORAGE_KEY, changelogs[0].version)
      renderLayout()
      const settingsLinks = screen.getAllByRole('link', { name: /더보기/i })
      settingsLinks.forEach(link => {
        const dot = link.querySelector('.bg-red-500.rounded-full')
        expect(dot).toBeNull()
      })
    })
  })

  describe('가구 전환 드롭다운', () => {
    it('가구가 2개 이상이면 모바일 헤더에 가구 전환 버튼이 표시된다', () => {
      householdStoreState = {
        ...householdStoreState,
        households: [{ id: 1, name: '우리집' }, { id: 2, name: '직장' }],
        activeHouseholdId: 1,
      }
      renderLayout()
      expect(screen.getAllByText('우리집').length).toBeGreaterThan(0)
    })

    it('가구가 1개면 드롭다운 없이 가구명만 표시한다', () => {
      householdStoreState = {
        ...householdStoreState,
        households: [{ id: 1, name: '우리집' }],
        activeHouseholdId: 1,
      }
      renderLayout()
      expect(screen.getAllByText('우리집').length).toBeGreaterThan(0)
    })
  })

  describe('초대 알림', () => {
    it('pending 초대가 있으면 초대 뱃지가 표시된다', () => {
      householdStoreState = {
        ...householdStoreState,
        households: [{ id: 1, name: '우리집' }],
        activeHouseholdId: 1,
        myInvitations: [{ id: 1, status: 'pending' }],
      }
      renderLayout()
      // 모바일 헤더 + 사이드바의 뱃지
      expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })

    it('pending 초대가 있으면 사이드바에 "받은 초대" 링크가 표시된다', () => {
      householdStoreState = {
        ...householdStoreState,
        households: [{ id: 1, name: '우리집' }],
        activeHouseholdId: 1,
        myInvitations: [{ id: 1, status: 'pending' }, { id: 2, status: 'pending' }],
      }
      renderLayout()
      expect(screen.getByText('받은 초대')).toBeInTheDocument()
      expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    })
  })

  describe('경로에 따른 활성 탭', () => {
    it('/insights 경로에서 돌아보기 탭이 활성화된다', () => {
      renderLayout('/insights')
      const insightsLinks = screen.getAllByRole('link', { name: /돌아보기/i })
      insightsLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    })

    it('/settings 경로에서 더보기 탭이 활성화된다', () => {
      renderLayout('/settings')
      const settingsLinks = screen.getAllByRole('link', { name: /더보기/i })
      settingsLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    })

    it('/assets 경로에서 자산 탭이 활성화된다', () => {
      renderLayout('/assets')
      const assetLinks = screen.getAllByRole('link', { name: /^자산$/i })
      assetLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    })
  })
})
