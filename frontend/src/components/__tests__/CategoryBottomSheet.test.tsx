/**
 * @file CategoryBottomSheet.test.tsx
 * @description CategoryBottomSheet 컴포넌트 테스트
 * 열기/닫기, 카테고리 선택, 키보드 접근성을 검증한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryBottomSheet from '../CategoryBottomSheet'
import { mockCategories } from '../../mocks/fixtures'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
  categories: mockCategories,
  currentCategoryId: null,
  transactionType: 'expense' as const,
}

function renderSheet(props = {}) {
  return render(<CategoryBottomSheet {...defaultProps} {...props} />)
}

describe('CategoryBottomSheet', () => {
  describe('기본 렌더링', () => {
    it('isOpen=true 일 때 시트를 표시한다', () => {
      renderSheet()
      expect(screen.getByText('카테고리 변경')).toBeInTheDocument()
    })

    it('isOpen=false 일 때 아무것도 렌더링하지 않는다', () => {
      renderSheet({ isOpen: false })
      expect(screen.queryByText('카테고리 변경')).not.toBeInTheDocument()
    })

    it('"분류 안 됨" 항목을 항상 표시한다', () => {
      renderSheet()
      expect(screen.getByText('분류 안 됨')).toBeInTheDocument()
    })
  })

  describe('카테고리 필터링', () => {
    it('transactionType=expense 일 때 expense와 both 타입만 표시한다', () => {
      renderSheet({ transactionType: 'expense' })
      // mockCategories: 식비(expense), 교통(expense), 쇼핑(both)
      expect(screen.getByText('식비')).toBeInTheDocument()
      expect(screen.getByText('교통')).toBeInTheDocument()
      expect(screen.getByText('쇼핑')).toBeInTheDocument()
    })

    it('transactionType=income 일 때 income과 both 타입만 표시한다', () => {
      const incomeCategories = [
        ...mockCategories,
        { id: 10, name: '급여', type: 'income' as const, description: '월급', sort_order: 1, created_at: '2024-01-01T00:00:00Z' },
      ]
      renderSheet({ transactionType: 'income', categories: incomeCategories })
      // income 타입과 both 타입만 표시
      expect(screen.getByText('급여')).toBeInTheDocument()
      expect(screen.getByText('쇼핑')).toBeInTheDocument()
      // expense 전용 카테고리는 표시 안 됨
      expect(screen.queryByText('식비')).not.toBeInTheDocument()
    })
  })

  describe('선택 동작', () => {
    it('카테고리 클릭 시 onSelect가 해당 id로 호출된다', async () => {
      const onSelect = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onSelect })

      await user.click(screen.getByText('식비'))
      expect(onSelect).toHaveBeenCalledWith(1)
    })

    it('"분류 안 됨" 클릭 시 onSelect가 null로 호출된다', async () => {
      const onSelect = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onSelect })

      await user.click(screen.getByText('분류 안 됨'))
      expect(onSelect).toHaveBeenCalledWith(null)
    })

    it('현재 선택된 카테고리에 활성 스타일이 적용된다', () => {
      renderSheet({ currentCategoryId: 1 })
      // 식비 버튼이 활성화 클래스를 가짐
      const shikbiButton = screen.getByText('식비')
      expect(shikbiButton.className).toContain('bg-grape-50')
    })
  })

  describe('닫기 동작', () => {
    it('닫기 버튼 클릭 시 onClose가 호출된다', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onClose })

      // X 아이콘 버튼 (aria-label 없으므로 role로 찾기)
      const buttons = screen.getAllByRole('button')
      // 닫기 버튼은 첫 번째 버튼 (헤더 X 버튼)
      const closeButton = buttons[0]
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('배경 오버레이 클릭 시 onClose가 호출된다', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onClose })

      // 오버레이는 .absolute.inset-0 클래스를 가진 div
      const overlay = document.querySelector('.absolute.inset-0.bg-black\\/40') as HTMLElement
      if (overlay) {
        await user.click(overlay)
        expect(onClose).toHaveBeenCalledTimes(1)
      }
    })

    it('Escape 키 입력 시 onClose가 호출된다', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      renderSheet({ onClose })

      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('저장 중 상태', () => {
    it('saving=true 일 때 로딩 스피너를 표시한다', () => {
      renderSheet({ saving: true })
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('saving=true 일 때 카테고리 목록을 숨긴다', () => {
      renderSheet({ saving: true })
      expect(screen.queryByText('식비')).not.toBeInTheDocument()
    })
  })
})
