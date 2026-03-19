/**
 * @file ParsedItemPreviewCard.test.tsx
 * @description ParsedItemPreviewCard 컴포넌트 테스트 (#148)
 *
 * label/colorScheme prop이 항목 타입에 따라 올바르게 렌더링되는지 검증한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParsedItemPreviewCard from '../ParsedItemPreviewCard'
import type { PreviewItem } from '../ParsedItemPreviewCard'

const mockItem: PreviewItem = {
  amount: 8000,
  date: '2026-03-19',
  description: '김치찌개',
  category: '식비',
  category_id: null,
  memo: null,
}

const defaultProps = {
  item: mockItem,
  index: 0,
  totalCount: 1,
  categories: [],
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  showNewCategoryFor: null,
  newCategoryName: '',
  creatingCategory: false,
  onSetShowNewCategory: vi.fn(),
  onSetNewCategoryName: vi.fn(),
  onCreateCategory: vi.fn(),
}

describe('ParsedItemPreviewCard', () => {
  describe('label prop 렌더링', () => {
    it('지출 label을 표시한다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.getByText('지출 #1')).toBeInTheDocument()
    })

    it('수입 label을 표시한다 (#148)', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          index={1}
          totalCount={3}
          colorScheme="leaf"
          label="수입"
        />
      )
      expect(screen.getByText('수입 #2')).toBeInTheDocument()
    })

    it('임의의 label과 index를 표시한다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          index={2}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.getByText('지출 #3')).toBeInTheDocument()
    })
  })

  describe('항목 삭제 버튼', () => {
    it('totalCount > 1이면 삭제 버튼이 표시된다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          totalCount={2}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.getByText('삭제')).toBeInTheDocument()
    })

    it('totalCount === 1이면 삭제 버튼이 없다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          totalCount={1}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.queryByText('삭제')).not.toBeInTheDocument()
    })

    it('삭제 버튼 클릭 시 onRemove(index)를 호출한다', () => {
      const onRemove = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          index={1}
          totalCount={2}
          colorScheme="grape"
          label="지출"
          onRemove={onRemove}
        />
      )
      fireEvent.click(screen.getByText('삭제'))
      expect(onRemove).toHaveBeenCalledWith(1)
    })
  })

  describe('필드 업데이트', () => {
    it('금액 입력 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const amountInput = screen.getByDisplayValue('8000')
      fireEvent.change(amountInput, { target: { value: '10000' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'amount', 10000)
    })

    it('설명 입력 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const descInput = screen.getByDisplayValue('김치찌개')
      fireEvent.change(descInput, { target: { value: '스타벅스' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'description', '스타벅스')
    })
  })
})
