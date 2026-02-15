/**
 * @file AcceptInvitationPage.test.tsx
 * @description 초대 수락 페이지 테스트
 * 토큰 기반 초대 수락/거절 기능을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import AcceptInvitationPage from '../AcceptInvitationPage'

// useToast 모킹
const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// useHouseholdStore 모킹
const mockAcceptInvitation = vi.fn()
const mockRejectInvitation = vi.fn()
const mockClearError = vi.fn()

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    acceptInvitation: mockAcceptInvitation,
    rejectInvitation: mockRejectInvitation,
    clearError: mockClearError,
  }),
}))

// window.confirm 모킹
const mockConfirm = vi.fn()
window.confirm = mockConfirm

/**
 * 토큰 파라미터가 있는 상태로 렌더링
 */
function renderWithToken(token?: string) {
  const path = token ? `/invitations/accept?token=${token}` : '/invitations/accept'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
        <Route path="/households/:id" element={<div>가구 상세 페이지</div>} />
        <Route path="/households" element={<div>가구 목록 페이지</div>} />
        <Route path="/invitations" element={<div>초대 목록 페이지</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('토큰이 없는 경우', () => {
    it('유효하지 않은 초대 링크 메시지를 표시한다', () => {
      renderWithToken()
      expect(screen.getByText('유효하지 않은 초대 링크입니다')).toBeInTheDocument()
    })

    it('가구 목록으로 이동 버튼을 표시한다', () => {
      renderWithToken()
      expect(screen.getByRole('button', { name: '가구 목록으로' })).toBeInTheDocument()
    })
  })

  describe('토큰이 있는 경우', () => {
    it('초대 수락 안내 페이지를 표시한다', () => {
      renderWithToken('test-token')
      expect(screen.getByText('가구 초대를 받으셨습니다')).toBeInTheDocument()
      expect(screen.getByText('아래 버튼을 눌러 초대를 수락하거나 거절하세요')).toBeInTheDocument()
    })

    it('수락, 거절, 나중에 결정 버튼을 표시한다', () => {
      renderWithToken('test-token')
      expect(screen.getByRole('button', { name: '초대 수락' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '초대 거절' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '나중에 결정' })).toBeInTheDocument()
    })
  })

  describe('초대 수락', () => {
    it('수락 버튼 클릭 시 acceptInvitation을 호출한다', async () => {
      const user = userEvent.setup()
      mockAcceptInvitation.mockResolvedValue({
        household_id: 1,
        household_name: '테스트 가구',
      })

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 수락' }))

      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalledWith('test-token')
      })
    })

    it('수락 성공 시 토스트를 표시하고 가구 상세 페이지로 이동한다', async () => {
      const user = userEvent.setup()
      mockAcceptInvitation.mockResolvedValue({
        household_id: 1,
        household_name: '테스트 가구',
      })

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 수락' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '테스트 가구 가구에 가입했습니다')
      })

      await waitFor(() => {
        expect(screen.getByText('가구 상세 페이지')).toBeInTheDocument()
      })
    })

    it('수락 실패 시 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      mockAcceptInvitation.mockRejectedValue(new Error('만료된 초대'))

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 수락' }))

      await waitFor(() => {
        expect(screen.getByText('초대 처리에 실패했습니다')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '초대 수락에 실패했습니다')
      })
    })
  })

  describe('초대 거절', () => {
    it('거절 버튼 클릭 시 confirm 후 rejectInvitation을 호출한다', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)
      mockRejectInvitation.mockResolvedValue(undefined)

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 거절' }))

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled()
        expect(mockRejectInvitation).toHaveBeenCalledWith('test-token')
      })
    })

    it('confirm을 취소하면 rejectInvitation을 호출하지 않는다', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 거절' }))

      expect(mockRejectInvitation).not.toHaveBeenCalled()
    })

    it('거절 성공 시 토스트를 표시하고 가구 목록으로 이동한다', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)
      mockRejectInvitation.mockResolvedValue(undefined)

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '초대 거절' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '초대를 거절했습니다')
      })

      await waitFor(() => {
        expect(screen.getByText('가구 목록 페이지')).toBeInTheDocument()
      })
    })
  })

  describe('나중에 결정', () => {
    it('나중에 결정 버튼 클릭 시 가구 목록으로 이동한다', async () => {
      const user = userEvent.setup()

      renderWithToken('test-token')

      await user.click(screen.getByRole('button', { name: '나중에 결정' }))

      await waitFor(() => {
        expect(screen.getByText('가구 목록 페이지')).toBeInTheDocument()
      })
    })
  })
})
