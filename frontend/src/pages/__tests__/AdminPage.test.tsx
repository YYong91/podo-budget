/**
 * @file AdminPage.test.tsx
 * @description 관리자 대시보드 페이지 테스트
 * 비관리자 차단, 탭 네비게이션, 대시보드 데이터 로드를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../AdminPage'

// useToast 모킹
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// useAuth 모킹 — 기본값은 관리자
let mockUser: { id: number; username: string; is_admin: boolean } | null = { id: 1, username: 'admin', is_admin: true }
let mockAuthLoading = false

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
  }),
}))

// adminApi 모킹
const mockGetDashboardStats = vi.fn()
vi.mock('../../api/admin', () => ({
  adminApi: {
    getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  },
}))

// AdminOverview, AdminFeedbackDashboard, AdminUserManager 모킹
vi.mock('../../components/admin/AdminOverview', () => ({
  default: ({ data }: { data: { total_users: number } }) => (
    <div data-testid="admin-overview">현황 탭 - 총 사용자: {data.total_users}</div>
  ),
}))

vi.mock('../../components/admin/AdminFeedbackDashboard', () => ({
  default: () => <div data-testid="admin-feedback">피드백 탭</div>,
}))

vi.mock('../../components/admin/AdminUserManager', () => ({
  default: () => <div data-testid="admin-users">사용자 탭</div>,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  )
}

const mockDashboard = {
  total_users: 150,
  active_users: 80,
  telegram_linked_count: 30,
  total_households: 20,
  today_active_users: 15,
  total_expenses_count: 5000,
  total_income_count: 1500,
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 1, username: 'admin', is_admin: true }
    mockAuthLoading = false
    mockGetDashboardStats.mockResolvedValue({ data: mockDashboard })
  })

  describe('접근 제어', () => {
    it('비관리자에게 접근 차단 메시지를 표시한다', () => {
      mockUser = { id: 1, username: 'user', is_admin: false }
      renderPage()

      expect(screen.getByText('관리자만 접근할 수 있습니다')).toBeInTheDocument()
    })

    it('인증 로딩 중에는 스피너를 표시한다', () => {
      mockAuthLoading = true
      renderPage()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('대시보드 로딩', () => {
    it('관리자 대시보드 제목을 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('관리자 대시보드')).toBeInTheDocument()
      })
    })

    it('대시보드 데이터를 로드한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalled()
      })
    })

    it('현황 탭을 기본으로 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('admin-overview')).toBeInTheDocument()
      })
      expect(screen.getByText(/총 사용자: 150/)).toBeInTheDocument()
    })
  })

  describe('탭 네비게이션', () => {
    it('3개 탭을 표시한다 (현황, 피드백, 사용자)', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('관리자 대시보드')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: '현황' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '피드백' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '사용자' })).toBeInTheDocument()
    })

    it('피드백 탭 클릭 시 피드백 컴포넌트를 표시한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('admin-overview')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '피드백' }))

      expect(screen.getByTestId('admin-feedback')).toBeInTheDocument()
    })

    it('사용자 탭 클릭 시 사용자 관리 컴포넌트를 표시한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('admin-overview')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '사용자' }))

      expect(screen.getByTestId('admin-users')).toBeInTheDocument()
    })
  })

  describe('새로고침', () => {
    it('새로고침 버튼을 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTitle('새로고침')).toBeInTheDocument()
      })
    })
  })
})
