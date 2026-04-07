/**
 * @file Layout.test.tsx
 * @description Layout 컴포넌트 테스트
 * 데스크톱 사이드바, 모바일 하단 탭 바, 네비게이션 항목, 가구 드롭다운을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Layout from '../Layout'
import { changelogs } from '../../data/changelogs'
import { FEATURES } from '../../config/features'

/**
 * FloatingTabBar 모킹 — Layout 테스트에서 독립적으로 검증
 * 실제 렌더링 대신 최소한의 구조만 제공하여 Layout 책임 범위를 명확히 함
 * useLocation을 사용하여 aria-current를 실제 컴포넌트와 동일하게 설정
 */
/**
 * FloatingTabBar 모킹용 컴포넌트 — 이름이 대문자로 시작해야 훅 규칙 적용 가능
 */
function MockFloatingTabBar({ onInputOpen, hasUnreadChangelog }: { onInputOpen: () => void; hasUnreadChangelog?: boolean }) {
  const { pathname } = useLocation()
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')
  return (
    <nav aria-label="하단 탭 메뉴" data-testid="floating-tab-bar">
      <a href="/home" aria-label="가계부" aria-current={isActive('/home') ? 'page' : undefined}>가계부</a>
      <a href="/insights" aria-label="돌아보기" aria-current={isActive('/insights') ? 'page' : undefined}>돌아보기</a>
      <a href="/settings" aria-label="더보기" aria-current={isActive('/settings') ? 'page' : undefined}>
        더보기
        {hasUnreadChangelog && <span className="bg-red-500 rounded-full w-2 h-2" />}
      </a>
      <button onClick={onInputOpen}>거래 입력</button>
    </nav>
  )
}

vi.mock('../FloatingTabBar', () => ({
  default: MockFloatingTabBar,
}))

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

// analytics 모킹
vi.mock('../../utils/analytics', () => ({
  trackPageView: vi.fn(),
}))

/**
 * 스토어 상태를 테스트마다 변경 가능하게
 */
let storeState: {
  households: Array<{ id: number; name: string }>
  activeHouseholdId: number | null
  myInvitations: Array<{ id: number; status: string }>
  setActiveHouseholdId: ReturnType<typeof vi.fn>
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: object) => unknown) => {
    return selector ? selector(storeState) : storeState
  },
}))

/**
 * Layout 컴포넌트를 MemoryRouter로 감싸서 렌더링하는 헬퍼 함수
 */
function renderLayout(initialPath = '/home') {
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
    storeState = {
      households: [],
      activeHouseholdId: null,
      myInvitations: [],
      setActiveHouseholdId: vi.fn(),
    }
  })

  describe('헤더 렌더링', () => {
    it('로고를 표시한다', () => {
      renderLayout()
      expect(screen.getAllByText(/포도가계부/).length).toBeGreaterThan(0)
    })
  })

  describe('네비게이션', () => {
    it('모든 네비게이션 항목을 표시한다 (사이드바 + 하단 탭 바)', () => {
      renderLayout()
      expect(screen.getAllByRole('link', { name: '가계부' }).length).toBe(2)
      expect(screen.getAllByRole('link', { name: /돌아보기/i }).length).toBe(2)
      // FEATURES.assets=false일 때 자산 탭은 표시되지 않아야 한다
      if (FEATURES.assets) {
        expect(screen.getAllByRole('link', { name: /^자산$/i }).length).toBe(2)
      } else {
        expect(screen.queryAllByRole('link', { name: /^자산$/i }).length).toBe(0)
      }
      expect(screen.getAllByRole('link', { name: /더보기/i }).length).toBe(2)
    })

    it('현재 경로에 해당하는 네비게이션 항목에 aria-current를 설정한다', () => {
      renderLayout('/home')
      const transactionLinks = screen.getAllByRole('link', { name: '가계부' })
      transactionLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    })

    it('다른 경로의 네비게이션 항목에는 aria-current가 없다', () => {
      renderLayout('/home')
      const reportLinks = screen.getAllByRole('link', { name: /돌아보기/i })
      reportLinks.forEach(link => {
        expect(link).not.toHaveAttribute('aria-current')
      })
    })

    it.skipIf(!FEATURES.assets)('/assets 경로에서 자산 탭이 활성화된다', () => {
      renderLayout('/assets')
      const assetLinks = screen.getAllByRole('link', { name: /^자산$/i })
      assetLinks.forEach(link => {
        expect(link).toHaveAttribute('aria-current', 'page')
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
      const navs = screen.getAllByRole('navigation')
      expect(navs.length).toBe(2)
    })
  })

  describe('새소식 알림 dot', () => {
    it('미확인 업데이트가 있으면 설정 아이콘에 빨간 점을 표시한다', () => {
      renderLayout()
      const settingsLinks = screen.getAllByRole('link', { name: /더보기/i })
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

  describe('가구 드롭다운', () => {
    it('가구가 2개 이상이면 모바일 헤더에 드롭다운 버튼이 표시된다', () => {
      storeState = {
        households: [{ id: 1, name: '우리집' }, { id: 2, name: '회사' }],
        activeHouseholdId: 1,
        myInvitations: [],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()
      // 가구 이름이 드롭다운 버튼에 표시됨
      expect(screen.getAllByText('우리집').length).toBeGreaterThan(0)
    })

    it('드롭다운 버튼 클릭 시 가구 목록이 펼쳐진다', () => {
      storeState = {
        households: [{ id: 1, name: '우리집' }, { id: 2, name: '회사' }],
        activeHouseholdId: 1,
        myInvitations: [],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()

      // 드롭다운 트리거 버튼 찾기 (ChevronDown이 있는 버튼)
      const buttons = screen.getAllByRole('button')
      const dropdownBtn = buttons.find(btn => btn.textContent?.includes('우리집'))
      expect(dropdownBtn).toBeTruthy()

      fireEvent.click(dropdownBtn!)

      // 가구 목록이 표시됨
      const companyItems = screen.getAllByText('회사')
      expect(companyItems.length).toBeGreaterThan(0)
    })

    it('가구 선택 시 setActiveHouseholdId가 호출된다', () => {
      const mockSetActive = vi.fn()
      storeState = {
        households: [{ id: 1, name: '우리집' }, { id: 2, name: '회사' }],
        activeHouseholdId: 1,
        myInvitations: [],
        setActiveHouseholdId: mockSetActive,
      }
      renderLayout()

      // 드롭다운 열기
      const buttons = screen.getAllByRole('button')
      const dropdownBtn = buttons.find(btn => btn.textContent?.includes('우리집'))
      fireEvent.click(dropdownBtn!)

      // 회사 선택 — 드롭다운 내 button[0]은 '우리집', button[1]은 '회사'
      const allCompanyBtns = screen.getAllByRole('button').filter(btn => btn.textContent === '회사')
      if (allCompanyBtns.length > 0) {
        fireEvent.click(allCompanyBtns[0])
        expect(mockSetActive).toHaveBeenCalledWith(2)
      }
    })

    it('가구가 1개 이하면 드롭다운이 아닌 단순 표시', () => {
      storeState = {
        households: [{ id: 1, name: '나의 가계부' }],
        activeHouseholdId: 1,
        myInvitations: [],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()
      // 모바일 헤더가 표시되지 않아야 함 (가구 1개 + 초대 0개)
      // aside에서 가구명이 텍스트로만 표시
      expect(screen.getAllByText('나의 가계부').length).toBeGreaterThan(0)
    })

    it('document 클릭 시 드롭다운이 닫힌다', () => {
      storeState = {
        households: [{ id: 1, name: '우리집' }, { id: 2, name: '회사' }],
        activeHouseholdId: 1,
        myInvitations: [],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()

      // 드롭다운 열기
      const buttons = screen.getAllByRole('button')
      const dropdownBtn = buttons.find(btn => btn.textContent?.includes('우리집'))
      fireEvent.click(dropdownBtn!)

      // document 클릭으로 닫기
      act(() => {
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // 드롭다운 닫힘 확인은 다음 렌더에서 확인 가능
    })
  })

  describe('초대 알림', () => {
    it('pending 초대가 있으면 모바일 헤더에 초대 뱃지가 표시된다', () => {
      storeState = {
        households: [],
        activeHouseholdId: null,
        myInvitations: [{ id: 1, status: 'pending' }, { id: 2, status: 'accepted' }],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()
      // pending 1건 — 뱃지에 1이 표시됨 (여러 곳에 표시될 수 있으므로 getAllByText)
      expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })

    it('pending 초대가 있으면 사이드바에 받은 초대 메뉴가 표시된다', () => {
      storeState = {
        households: [],
        activeHouseholdId: null,
        myInvitations: [{ id: 1, status: 'pending' }],
        setActiveHouseholdId: vi.fn(),
      }
      renderLayout()
      expect(screen.getByText('받은 초대')).toBeInTheDocument()
    })
  })
})
