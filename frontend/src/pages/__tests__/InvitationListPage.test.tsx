/**
 * @file InvitationListPage.test.tsx
 * @description 받은 초대 목록 페이지 테스트
 * 초대 목록 표시, 수락/거절, 빈 상태, 에러 상태를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import InvitationListPage from '../InvitationListPage'

// useToast 모킹
const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// useHouseholdStore 모킹 변수
const mockFetchMyInvitations = vi.fn()
const mockAcceptInvitation = vi.fn()
const mockRejectInvitation = vi.fn()
const mockClearError = vi.fn()

// 미래 날짜 (7일 후)
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const mockInvitations = [
  {
    id: 1,
    household_id: 1,
    household_name: '테스트 가구',
    invitee_email: 'test@test.com',
    inviter_username: '홍길동',
    role: 'member' as const,
    status: 'pending' as const,
    token: 'test-token-1',
    expires_at: futureDate,
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    household_id: 2,
    household_name: '두번째 가구',
    invitee_email: 'test@test.com',
    inviter_username: '김철수',
    role: 'admin' as const,
    status: 'pending' as const,
    token: 'test-token-2',
    expires_at: futureDate,
    created_at: '2024-01-16T10:00:00Z',
  },
]

let storeState: {
  myInvitations: typeof mockInvitations
  isLoading: boolean
  error: string | null
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    ...storeState,
    fetchMyInvitations: mockFetchMyInvitations,
    acceptInvitation: mockAcceptInvitation,
    rejectInvitation: mockRejectInvitation,
    clearError: mockClearError,
  }),
}))

// window.confirm 모킹
const mockConfirm = vi.fn()
window.confirm = mockConfirm

function renderInvitationList() {
  return render(
    <MemoryRouter>
      <InvitationListPage />
    </MemoryRouter>
  )
}

describe('InvitationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchMyInvitations.mockResolvedValue(undefined)
    storeState = {
      myInvitations: [],
      isLoading: false,
      error: null,
    }
  })

  describe('기본 렌더링', () => {
    it('페이지 제목 "받은 초대"를 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByRole('heading', { name: '받은 초대' })).toBeInTheDocument()
    })

    it('부가 설명을 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByText('다른 사람이 보낸 가구 초대를 확인하고 수락하세요')).toBeInTheDocument()
    })
  })

  describe('로딩 상태', () => {
    it('로딩 중에는 스피너를 표시한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: true,
        error: null,
      }

      renderInvitationList()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('초대 목록 표시', () => {
    it('초대 목록을 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByText('테스트 가구')).toBeInTheDocument()
      expect(screen.getByText('두번째 가구')).toBeInTheDocument()
    })

    it('초대자 이름을 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByText('홍길동')).toBeInTheDocument()
      expect(screen.getByText('김철수')).toBeInTheDocument()
    })

    it('역할을 한글로 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByText('멤버')).toBeInTheDocument()
      expect(screen.getByText('관리자')).toBeInTheDocument()
    })

    it('수락/거절 버튼을 표시한다', () => {
      storeState = {
        myInvitations: mockInvitations,
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      const acceptButtons = screen.getAllByRole('button', { name: '수락' })
      const rejectButtons = screen.getAllByRole('button', { name: '거절' })
      expect(acceptButtons).toHaveLength(2)
      expect(rejectButtons).toHaveLength(2)
    })
  })

  describe('빈 상태', () => {
    it('초대가 없으면 빈 상태 메시지를 표시한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByText('받은 초대가 없습니다')).toBeInTheDocument()
      expect(screen.getByText('다른 사람으로부터 초대를 받으면 여기에 표시됩니다')).toBeInTheDocument()
    })

    it('빈 상태에서 가구 목록으로 버튼을 표시한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(screen.getByRole('button', { name: '가구 목록으로' })).toBeInTheDocument()
    })
  })

  describe('에러 상태', () => {
    it('에러 발생 시 에러 상태를 표시한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: false,
        error: '네트워크 오류',
      }

      renderInvitationList()

      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })

    it('에러 상태에서 다시 시도 버튼을 표시한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: false,
        error: '네트워크 오류',
      }

      renderInvitationList()

      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    })
  })

  describe('초대 수락', () => {
    it('수락 버튼 클릭 시 acceptInvitation을 호출한다', async () => {
      const user = userEvent.setup()
      mockAcceptInvitation.mockResolvedValue({
        household_id: 1,
        household_name: '테스트 가구',
      })

      storeState = {
        myInvitations: [mockInvitations[0]],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      await user.click(screen.getByRole('button', { name: '수락' }))

      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalledWith('test-token-1')
      })
    })

    it('수락 성공 시 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      mockAcceptInvitation.mockResolvedValue({
        household_id: 1,
        household_name: '테스트 가구',
      })

      storeState = {
        myInvitations: [mockInvitations[0]],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      await user.click(screen.getByRole('button', { name: '수락' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '테스트 가구 가구에 가입했습니다')
      })
    })
  })

  describe('초대 거절', () => {
    it('거절 버튼 클릭 시 confirm 후 rejectInvitation을 호출한다', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)
      mockRejectInvitation.mockResolvedValue(undefined)

      storeState = {
        myInvitations: [mockInvitations[0]],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      await user.click(screen.getByRole('button', { name: '거절' }))

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled()
        expect(mockRejectInvitation).toHaveBeenCalledWith('test-token-1')
      })
    })

    it('confirm을 취소하면 rejectInvitation을 호출하지 않는다', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      storeState = {
        myInvitations: [mockInvitations[0]],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      await user.click(screen.getByRole('button', { name: '거절' }))

      expect(mockRejectInvitation).not.toHaveBeenCalled()
    })
  })

  describe('마운트 시 데이터 조회', () => {
    it('컴포넌트 마운트 시 fetchMyInvitations를 호출한다', () => {
      storeState = {
        myInvitations: [],
        isLoading: false,
        error: null,
      }

      renderInvitationList()

      expect(mockFetchMyInvitations).toHaveBeenCalled()
    })
  })
})
