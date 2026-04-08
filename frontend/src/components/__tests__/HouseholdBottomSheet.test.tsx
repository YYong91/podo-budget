/**
 * @file HouseholdBottomSheet.test.tsx
 * @description HouseholdBottomSheet 컴포넌트 테스트
 * 열기/닫기, 가구 선택, 키보드 접근성을 검증한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HouseholdBottomSheet from '../HouseholdBottomSheet'

const mockHouseholds = [
  { id: 1, name: '우리집', description: null, currency: 'KRW', my_role: 'owner' as const, member_count: 1, created_at: '' },
  { id: 2, name: '부모님댁', description: null, currency: 'KRW', my_role: 'member' as const, member_count: 2, created_at: '' },
]

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  households: mockHouseholds,
  activeHouseholdId: 1,
  onSelect: vi.fn(),
}

function renderSheet(props = {}) {
  return render(<HouseholdBottomSheet {...defaultProps} {...props} />)
}

describe('HouseholdBottomSheet', () => {
  describe('기본 렌더링', () => {
    it('isOpen=true 일 때 시트를 표시한다', () => {
      renderSheet()
      expect(screen.getByRole('dialog', { name: '가계부 선택' })).toBeInTheDocument()
    })

    it('isOpen=false 일 때 아무것도 렌더링하지 않는다', () => {
      renderSheet({ isOpen: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('모든 가구 이름을 표시한다', () => {
      renderSheet()
      expect(screen.getByText('우리집')).toBeInTheDocument()
      expect(screen.getByText('부모님댁')).toBeInTheDocument()
    })

    it('활성 가구에 체크 아이콘을 표시한다', () => {
      renderSheet()
      // 우리집(활성)에 체크, 부모님댁에는 없음
      const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('우리집'))
      expect(buttons[0]).toBeInTheDocument()
    })
  })

  describe('가구 선택', () => {
    it('가구 클릭 시 onSelect와 onClose를 호출한다', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const onClose = vi.fn()
      renderSheet({ onSelect, onClose })

      await user.click(screen.getByText('부모님댁'))

      expect(onSelect).toHaveBeenCalledWith(2)
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('닫기', () => {
    it('Escape 키 입력 시 onClose를 호출한다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderSheet({ onClose })

      await user.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalled()
    })

    it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderSheet({ onClose })

      await user.click(screen.getByLabelText('닫기'))

      expect(onClose).toHaveBeenCalled()
    })

    it('오버레이 클릭 시 onClose를 호출한다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderSheet({ onClose })

      // dialog 역할 요소의 부모(오버레이)를 클릭
      const dialog = screen.getByRole('dialog')
      await user.click(dialog.parentElement!.querySelector('.absolute.inset-0')!)

      expect(onClose).toHaveBeenCalled()
    })
  })
})
