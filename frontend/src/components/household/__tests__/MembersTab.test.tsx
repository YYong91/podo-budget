/**
 * @file MembersTab.test.tsx
 * @description 멤버 탭 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MembersTab from '../MembersTab'
import type { HouseholdDetail } from '../../../types'

const mockHousehold: HouseholdDetail = {
  id: 1,
  name: '우리집',
  description: '가족 가계부',
  currency: 'KRW',
  my_role: 'owner',
  member_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  members: [
    {
      user_id: 1,
      username: '홍길동',
      email: 'hong@example.com',
      role: 'owner',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      user_id: 2,
      username: '김철수',
      email: 'kim@example.com',
      role: 'member',
      joined_at: '2026-02-01T00:00:00Z',
    },
  ],
}

const defaultProps = {
  household: mockHousehold,
  currentUserId: 1,
  canManageMember: (member: { user_id: number; role: string }, currentUserId: number) =>
    member.user_id !== currentUserId && member.role !== 'owner',
  onRoleChange: vi.fn(),
  onRemoveMember: vi.fn(),
  onLeave: vi.fn(),
}

describe('MembersTab', () => {
  it('멤버 이름을 표시한다', () => {
    render(<MembersTab {...defaultProps} />)
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('김철수')).toBeInTheDocument()
  })

  it('멤버 이메일을 표시한다', () => {
    render(<MembersTab {...defaultProps} />)
    expect(screen.getByText('hong@example.com')).toBeInTheDocument()
    expect(screen.getByText('kim@example.com')).toBeInTheDocument()
  })

  it('자기 자신에게 (나) 표시를 한다', () => {
    render(<MembersTab {...defaultProps} />)
    expect(screen.getByText('(나)')).toBeInTheDocument()
  })

  it('관리 가능한 멤버에 내보내기 버튼을 표시한다', () => {
    render(<MembersTab {...defaultProps} />)
    expect(screen.getByText('내보내기')).toBeInTheDocument()
  })

  it('내보내기 버튼 클릭 시 onRemoveMember를 호출한다', async () => {
    const user = userEvent.setup()
    render(<MembersTab {...defaultProps} />)
    await user.click(screen.getByText('내보내기'))
    expect(defaultProps.onRemoveMember).toHaveBeenCalledWith(2, '김철수')
  })

  it('관리 가능한 멤버에 역할 드롭다운을 표시한다', () => {
    render(<MembersTab {...defaultProps} />)
    // 김철수(member)에 대한 select가 있어야 함
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(1)
    expect(selects[0]).toHaveValue('member')
  })

  it('관리 권한이 없으면 내보내기 버튼 대신 탈퇴 버튼이 표시된다', () => {
    const cannotManage = () => false
    render(
      <MembersTab
        {...defaultProps}
        canManageMember={cannotManage}
        currentUserId={2}
      />
    )
    // 김철수(userId=2)의 탈퇴 버튼
    expect(screen.getByText('탈퇴')).toBeInTheDocument()
  })
})
