/**
 * @file SettingsTab.test.tsx
 * @description 설정 탭 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsTab from '../SettingsTab'
import type { HouseholdDetail } from '../../../types'

const mockHousehold: HouseholdDetail = {
  id: 1,
  name: '우리집',
  description: '가족 가계부',
  currency: 'KRW',
  my_role: 'owner',
  member_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  members: [],
}

const defaultProps = {
  household: mockHousehold,
  isOwner: true,
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn(),
}

describe('SettingsTab', () => {
  it('가구 이름을 표시한다', () => {
    render(<SettingsTab {...defaultProps} />)
    expect(screen.getByDisplayValue('우리집')).toBeInTheDocument()
  })

  it('가구 설명을 표시한다', () => {
    render(<SettingsTab {...defaultProps} />)
    expect(screen.getByDisplayValue('가족 가계부')).toBeInTheDocument()
  })

  it('수정 버튼을 표시한다', () => {
    render(<SettingsTab {...defaultProps} />)
    expect(screen.getByText('수정')).toBeInTheDocument()
  })

  it('수정 버튼 클릭 시 편집 모드로 전환한다', async () => {
    const user = userEvent.setup()
    render(<SettingsTab {...defaultProps} />)
    await user.click(screen.getByText('수정'))
    // 편집 모드에서는 저장/취소 버튼이 표시됨
    expect(screen.getByText('저장')).toBeInTheDocument()
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('취소 시 편집 모드를 종료하고 원래 값으로 복원한다', async () => {
    const user = userEvent.setup()
    render(<SettingsTab {...defaultProps} />)
    await user.click(screen.getByText('수정'))
    const input = screen.getByDisplayValue('우리집')
    await user.clear(input)
    await user.type(input, '새 이름')
    await user.click(screen.getByText('취소'))
    expect(screen.getByDisplayValue('우리집')).toBeInTheDocument()
  })

  it('owner에게 가구 삭제 영역을 표시한다', () => {
    render(<SettingsTab {...defaultProps} />)
    expect(screen.getByText('위험 영역')).toBeInTheDocument()
    expect(screen.getByText('가구 삭제')).toBeInTheDocument()
  })

  it('owner가 아니면 삭제 영역을 숨긴다', () => {
    render(<SettingsTab {...defaultProps} isOwner={false} />)
    expect(screen.queryByText('위험 영역')).not.toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 onDelete를 호출한다', async () => {
    const user = userEvent.setup()
    render(<SettingsTab {...defaultProps} />)
    await user.click(screen.getByText('가구 삭제'))
    expect(defaultProps.onDelete).toHaveBeenCalled()
  })

  it('입력 필드가 편집 모드가 아니면 비활성화되어 있다', () => {
    render(<SettingsTab {...defaultProps} />)
    const nameInput = screen.getByDisplayValue('우리집')
    expect(nameInput).toBeDisabled()
  })

  it('저장 시 onUpdate를 호출한다', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<SettingsTab {...defaultProps} onUpdate={onUpdate} />)
    await user.click(screen.getByText('수정'))
    const input = screen.getByDisplayValue('우리집')
    await user.clear(input)
    await user.type(input, '새 이름')
    await user.click(screen.getByText('저장'))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: '새 이름' }))
  })

  it('편집 모드에서 입력 필드가 활성화된다', async () => {
    const user = userEvent.setup()
    render(<SettingsTab {...defaultProps} />)
    await user.click(screen.getByText('수정'))
    const nameInput = screen.getByDisplayValue('우리집')
    expect(nameInput).not.toBeDisabled()
  })

  it('설명 없는 가구도 표시한다', () => {
    const household = { ...mockHousehold, description: '' }
    render(<SettingsTab {...defaultProps} household={household} />)
    expect(screen.getByDisplayValue('우리집')).toBeInTheDocument()
  })
})
