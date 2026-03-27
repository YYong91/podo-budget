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

    it('날짜 입력 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const dateInput = screen.getByDisplayValue('2026-03-19')
      fireEvent.change(dateInput, { target: { value: '2026-03-20' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'date', '2026-03-20')
    })

    it('카테고리 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      const categories = [{ id: 1, name: '식비', type: 'expense' as const, description: null, sort_order: 1, is_savings: false, is_system: true, exclude_auto_payment: false, created_at: '' }]
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          categories={categories}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '1' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'category_id', 1)
    })

    it('카테고리 "분류 안 됨"으로 변경 시 null을 전달한다', () => {
      const onUpdate = vi.fn()
      const itemWithCat = { ...mockItem, category_id: 1 }
      const categories = [{ id: 1, name: '식비', type: 'expense' as const, description: null, sort_order: 1, is_savings: false, is_system: true, exclude_auto_payment: false, created_at: '' }]
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          item={itemWithCat}
          categories={categories}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'category_id', null)
    })

    it('메모 입력 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          onUpdate={onUpdate}
        />
      )
      const memoInput = screen.getByPlaceholderText('추가 메모 입력')
      fireEvent.change(memoInput, { target: { value: '점심' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'memo', '점심')
    })
  })

  describe('새 카테고리 생성', () => {
    it('+ 새 카테고리 버튼 클릭 시 onSetShowNewCategory를 호출한다', () => {
      const onSetShowNewCategory = vi.fn()
      const onSetNewCategoryName = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          onSetShowNewCategory={onSetShowNewCategory}
          onSetNewCategoryName={onSetNewCategoryName}
        />
      )
      fireEvent.click(screen.getByText('+ 새 카테고리'))
      expect(onSetShowNewCategory).toHaveBeenCalledWith(0)
      expect(onSetNewCategoryName).toHaveBeenCalledWith('')
    })

    it('새 카테고리 입력 필드가 표시된다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.getByPlaceholderText('새 카테고리 이름')).toBeInTheDocument()
      expect(screen.getByText('추가')).toBeInTheDocument()
      expect(screen.getByText('취소')).toBeInTheDocument()
    })

    it('추가 버튼 클릭 시 onCreateCategory를 호출한다', () => {
      const onCreateCategory = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          newCategoryName="새카테고리"
          colorScheme="grape"
          label="지출"
          onCreateCategory={onCreateCategory}
        />
      )
      fireEvent.click(screen.getByText('추가'))
      expect(onCreateCategory).toHaveBeenCalledWith(0)
    })

    it('Enter 키 입력 시 onCreateCategory를 호출한다', () => {
      const onCreateCategory = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          newCategoryName="새카테고리"
          colorScheme="grape"
          label="지출"
          onCreateCategory={onCreateCategory}
        />
      )
      const input = screen.getByPlaceholderText('새 카테고리 이름')
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      expect(onCreateCategory).toHaveBeenCalledWith(0)
    })

    it('취소 버튼 클릭 시 onSetShowNewCategory(null)을 호출한다', () => {
      const onSetShowNewCategory = vi.fn()
      const onSetNewCategoryName = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          colorScheme="grape"
          label="지출"
          onSetShowNewCategory={onSetShowNewCategory}
          onSetNewCategoryName={onSetNewCategoryName}
        />
      )
      fireEvent.click(screen.getByText('취소'))
      expect(onSetShowNewCategory).toHaveBeenCalledWith(null)
      expect(onSetNewCategoryName).toHaveBeenCalledWith('')
    })

    it('카테고리 생성 중이면 추가 버튼이 ... 로 표시된다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          newCategoryName="새카테고리"
          creatingCategory={true}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.getByText('...')).toBeInTheDocument()
    })

    it('카테고리 이름이 비어있으면 추가 버튼이 비활성화된다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          showNewCategoryFor={0}
          newCategoryName=""
          colorScheme="grape"
          label="지출"
        />
      )
      const addBtn = screen.getByText('추가')
      expect(addBtn).toBeDisabled()
    })
  })

  describe('leaf 색상 테마', () => {
    it('leaf 색상 테마로 렌더링된다', () => {
      const { container } = render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="leaf"
          label="수입"
        />
      )
      expect(container.querySelector('.border-l-leaf-400')).toBeInTheDocument()
    })
  })

  describe('결제수단 선택', () => {
    const paymentMethods = [
      { id: 1, household_id: 1, created_by: 1, name: '삼성카드', type: 'credit_card' as const, monthly_target: null, is_default: true, is_active: true, display_order: 0, created_at: '', updated_at: '' },
      { id: 2, household_id: 1, created_by: 1, name: '현금', type: 'cash' as const, monthly_target: null, is_default: false, is_active: true, display_order: 1, created_at: '', updated_at: '' },
    ]

    it('결제수단 드롭다운을 표시한다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          paymentMethods={paymentMethods}
        />
      )
      expect(screen.getByLabelText('결제수단')).toBeInTheDocument()
    })

    it('결제수단 변경 시 onUpdate를 호출한다', () => {
      const onUpdate = vi.fn()
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
          paymentMethods={paymentMethods}
          onUpdate={onUpdate}
        />
      )
      const pmSelect = screen.getByLabelText('결제수단')
      fireEvent.change(pmSelect, { target: { value: '1' } })
      expect(onUpdate).toHaveBeenCalledWith(0, 'payment_method_id', 1)
    })

    it('paymentMethods가 없으면 드롭다운을 표시하지 않는다', () => {
      render(
        <ParsedItemPreviewCard
          {...defaultProps}
          colorScheme="grape"
          label="지출"
        />
      )
      expect(screen.queryByLabelText('결제수단')).not.toBeInTheDocument()
    })
  })
})
