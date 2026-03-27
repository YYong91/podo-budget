/**
 * @file OnboardingPage.test.tsx
 * @description 온보딩 페이지 테스트
 * 가계부 생성 및 초대 수락 플로우를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import OnboardingPage from '../OnboardingPage'

// 네비게이션 모킹
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

// 토스트 훅 모킹
let mockAddToast: ReturnType<typeof vi.fn>
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

// onboardingApi 모킹
vi.mock('../../api/onboarding', () => ({
  onboardingApi: {
    createHousehold: vi.fn().mockResolvedValue({ data: { id: 1, name: '내 가계부' } }),
  },
}))

// useHouseholdStore 모킹 — 초대 없는 기본 상태
const mockFetchHouseholds = vi.fn().mockResolvedValue(undefined)
const mockFetchMyInvitations = vi.fn().mockResolvedValue(undefined)
const mockAcceptInvitation = vi.fn().mockResolvedValue(undefined)

// 모킹 상태를 제어할 수 있는 객체
const mockStoreState = {
  myInvitations: [] as Array<{
    id: number
    token: string
    household_name: string
    inviter_username: string
    status: string
  }>,
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      ...mockStoreState,
      fetchHouseholds: mockFetchHouseholds,
      fetchMyInvitations: mockFetchMyInvitations,
      acceptInvitation: mockAcceptInvitation,
    }
    return selector ? selector(state) : state
  },
}))

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAddToast = vi.fn()
  mockNavigate.mockClear()
  mockFetchHouseholds.mockClear()
  mockAcceptInvitation.mockClear()
  // 초대 상태 초기화
  mockStoreState.myInvitations = []
})

describe('OnboardingPage', () => {
  describe('기본 렌더링', () => {
    it('제목을 표시한다', () => {
      renderOnboarding()
      expect(screen.getByText('포도가계부 시작하기')).toBeInTheDocument()
    })

    it('초대가 없을 때 안내 문구를 표시한다', () => {
      renderOnboarding()
      expect(screen.getByText('나만의 가계부를 만들어보세요')).toBeInTheDocument()
    })

    it('가계부 이름 입력 필드와 생성 버튼을 표시한다', () => {
      renderOnboarding()
      expect(screen.getByPlaceholderText('가계부 이름 (비워두면 기본 이름)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '새 가계부 만들기' })).toBeInTheDocument()
    })
  })

  describe('가계부 생성', () => {
    it('생성 버튼 클릭 시 API를 호출하고 홈으로 이동한다', async () => {
      const user = userEvent.setup()
      renderOnboarding()

      await user.type(screen.getByPlaceholderText('가계부 이름 (비워두면 기본 이름)'), '우리집 가계부')
      await user.click(screen.getByRole('button', { name: '새 가계부 만들기' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '가계부를 만들었어요')
        expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true })
      })
    })

    it('Enter 키로도 가계부를 생성할 수 있다', async () => {
      const user = userEvent.setup()
      renderOnboarding()

      const input = screen.getByPlaceholderText('가계부 이름 (비워두면 기본 이름)')
      await user.type(input, '엔터 테스트{Enter}')

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '가계부를 만들었어요')
      })
    })

    it('생성 실패 시 에러 토스트를 표시한다', async () => {
      const { onboardingApi } = await import('../../api/onboarding')
      vi.mocked(onboardingApi.createHousehold).mockRejectedValueOnce(new Error('서버 오류'))

      const user = userEvent.setup()
      renderOnboarding()

      await user.click(screen.getByRole('button', { name: '새 가계부 만들기' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '가계부 생성에 실패했어요')
      })
    })
  })

  describe('초대 있을 때', () => {
    beforeEach(() => {
      mockStoreState.myInvitations = [
        {
          id: 1,
          token: 'invite-token-abc',
          household_name: '부부 가계부',
          inviter_username: 'spouse',
          status: 'pending',
        },
      ]
    })

    it('초대가 있을 때 "초대받은 가계부에 참여하거나..." 안내 문구를 표시한다', () => {
      renderOnboarding()
      expect(screen.getByText('초대받은 가계부에 참여하거나 새로 만들어보세요')).toBeInTheDocument()
    })

    it('초대 목록과 참여 버튼을 표시한다', () => {
      renderOnboarding()
      expect(screen.getByText('부부 가계부')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '참여' })).toBeInTheDocument()
    })

    it('참여 버튼 클릭 시 acceptInvitation을 호출하고 홈으로 이동한다', async () => {
      const user = userEvent.setup()
      renderOnboarding()

      await user.click(screen.getByRole('button', { name: '참여' }))

      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalledWith('invite-token-abc')
        expect(mockAddToast).toHaveBeenCalledWith('success', '부부 가계부에 참여했어요')
        expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true })
      })
    })

    it('초대 수락 실패 시 에러 토스트를 표시한다', async () => {
      mockAcceptInvitation.mockRejectedValueOnce(new Error('수락 실패'))
      mockFetchMyInvitations.mockResolvedValue(undefined)

      const user = userEvent.setup()
      renderOnboarding()

      await user.click(screen.getByRole('button', { name: '참여' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '초대 수락에 실패했어요')
      })
    })
  })
})
