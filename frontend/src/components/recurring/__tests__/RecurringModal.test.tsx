/**
 * @file RecurringModal.test.tsx
 * @description 반복 거래 모달 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurringModal from '../RecurringModal'
import type { RecurringFormData } from '../RecurringModal'
import type { Category } from '../../../types'

const emptyForm: RecurringFormData = {
  type: 'expense',
  amount: '',
  description: '',
  category_id: '',
  frequency: 'monthly',
  day_of_month: '25',
  day_of_week: '0',
  month_of_year: '1',
  interval: '14',
  start_date: '2026-01-01',
  end_date: '',
}

const mockCategories: Category[] = [
  { id: 1, name: '식비', type: 'expense', description: null, sort_order: 1, is_system: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: '급여', type: 'income', description: null, sort_order: 2, is_system: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 3, name: '기타', type: 'both', description: null, sort_order: 3, is_system: true, created_at: '2026-01-01T00:00:00Z' },
]

const defaultProps = {
  editingId: null,
  formData: emptyForm,
  onFormChange: vi.fn(),
  categories: mockCategories,
  submitting: false,
  onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
  onClose: vi.fn(),
}

describe('RecurringModal', () => {
  it('추가 모드에서 제목을 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByText('반복 거래 추가')).toBeInTheDocument()
  })

  it('수정 모드에서 제목을 표시한다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    expect(screen.getByText('반복 거래 수정')).toBeInTheDocument()
  })

  it('추가 모드에서 유형 선택 버튼을 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('수정 모드에서 유형 선택 버튼을 숨긴다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    // 유형 선택 영역의 "지출/수입" 버튼이 없어야 함
    // (카테고리 옵션에 식비 등이 있을 수 있으므로 정확한 컨텍스트로 확인)
    expect(screen.queryByText('유형')).not.toBeInTheDocument()
  })

  it('추가 모드에서 빈도 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByLabelText('반복 빈도')).toBeInTheDocument()
    expect(screen.getByLabelText('반복일')).toBeInTheDocument()
    expect(screen.getByLabelText('시작일')).toBeInTheDocument()
  })

  it('수정 모드에서 빈도 필드를 숨긴다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    expect(screen.queryByLabelText('반복 빈도')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('시작일')).not.toBeInTheDocument()
  })

  it('종료일 필드를 항상 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByLabelText('종료일 (선택)')).toBeInTheDocument()
  })

  it('expense 타입일 때 expense 카테고리와 both 카테고리를 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    const categorySelect = screen.getByLabelText('카테고리')
    // 식비(expense) + 기타(both) = 2개 + 선택 안 함
    expect(categorySelect.querySelectorAll('option').length).toBe(3)
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} />)
    await user.click(screen.getByLabelText('닫기'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('제출 중이면 저장 버튼이 비활성화된다', () => {
    render(<RecurringModal {...defaultProps} submitting={true} />)
    const submitBtn = screen.getByText('저장 중...')
    expect(submitBtn).toBeDisabled()
  })

  it('추가 모드에서 추가하기 버튼을 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByText('추가하기')).toBeInTheDocument()
  })

  it('수정 모드에서 수정하기 버튼을 표시한다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    expect(screen.getByText('수정하기')).toBeInTheDocument()
  })
})
