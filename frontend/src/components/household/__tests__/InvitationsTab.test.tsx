/**
 * @file InvitationsTab.test.tsx
 * @description 초대 탭 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvitationsTab from '../InvitationsTab'
import type { HouseholdInvitation } from '../../../types'

const mockInvitations: HouseholdInvitation[] = [
  {
    id: 1,
    household_id: 1,
    invitee_email: 'test@example.com',
    role: 'member',
    status: 'pending',
    token: 'abc123',
    expires_at: '2026-12-31T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    household_id: 1,
    invitee_email: 'accepted@example.com',
    role: 'admin',
    status: 'accepted',
    expires_at: '2026-12-31T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
]

const defaultProps = {
  invitations: mockInvitations,
  onOpenInviteModal: vi.fn(),
  onCancelInvitation: vi.fn().mockResolvedValue(undefined),
  onCopyInviteLink: vi.fn().mockResolvedValue(undefined),
}

describe('InvitationsTab', () => {
  it('초대 목록을 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('accepted@example.com')).toBeInTheDocument()
  })

  it('초대 상태를 한국어로 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('대기 중')).toBeInTheDocument()
    expect(screen.getByText('수락 완료')).toBeInTheDocument()
  })

  it('대기 중 초대에 취소 버튼을 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('대기 중 초대에 링크 복사 버튼을 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('링크 복사')).toBeInTheDocument()
  })

  it('+ 멤버 초대 버튼을 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('+ 멤버 초대')).toBeInTheDocument()
  })

  it('멤버 초대 버튼 클릭 시 onOpenInviteModal을 호출한다', async () => {
    const user = userEvent.setup()
    render(<InvitationsTab {...defaultProps} />)
    await user.click(screen.getByText('+ 멤버 초대'))
    expect(defaultProps.onOpenInviteModal).toHaveBeenCalled()
  })

  it('링크 복사 버튼 클릭 시 onCopyInviteLink를 호출한다', async () => {
    const user = userEvent.setup()
    render(<InvitationsTab {...defaultProps} />)
    await user.click(screen.getByText('링크 복사'))
    expect(defaultProps.onCopyInviteLink).toHaveBeenCalledWith('abc123')
  })

  it('취소 버튼 클릭 시 onCancelInvitation을 호출한다', async () => {
    const user = userEvent.setup()
    render(<InvitationsTab {...defaultProps} />)
    await user.click(screen.getByText('취소'))
    expect(defaultProps.onCancelInvitation).toHaveBeenCalledWith(1)
  })

  it('초대가 없으면 빈 상태 메시지를 표시한다', () => {
    render(<InvitationsTab {...defaultProps} invitations={[]} />)
    expect(screen.getByText('보낸 초대가 없습니다')).toBeInTheDocument()
  })

  it('역할을 한국어로 표시한다', () => {
    render(<InvitationsTab {...defaultProps} />)
    expect(screen.getByText('관리자')).toBeInTheDocument()
    // mockInvitations[0]의 role='member'
    expect(screen.getAllByText('멤버').length).toBeGreaterThan(0)
  })
})
