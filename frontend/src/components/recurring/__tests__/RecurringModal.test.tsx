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
  // ==================== 추가 vs 수정 모드 ====================

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

  it('추가 모드에서 추가하기 버튼을 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByText('추가하기')).toBeInTheDocument()
  })

  it('수정 모드에서 수정하기 버튼을 표시한다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    expect(screen.getByText('수정하기')).toBeInTheDocument()
  })

  // ==================== 빈도별 필드 전환 ====================

  it('monthly 빈도일 때 반복일 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, frequency: 'monthly' }} />)
    expect(screen.getByLabelText('반복일')).toBeInTheDocument()
    expect(screen.queryByLabelText('요일')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('반복 주기 (일)')).not.toBeInTheDocument()
  })

  it('weekly 빈도일 때 요일 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, frequency: 'weekly' }} />)
    expect(screen.getByLabelText('요일')).toBeInTheDocument()
    expect(screen.queryByLabelText('반복일')).not.toBeInTheDocument()
  })

  it('yearly 빈도일 때 반복일과 반복 월 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, frequency: 'yearly' }} />)
    expect(screen.getByLabelText('반복일')).toBeInTheDocument()
    expect(screen.getByLabelText('반복 월')).toBeInTheDocument()
    expect(screen.queryByLabelText('요일')).not.toBeInTheDocument()
  })

  it('custom 빈도일 때 반복 주기 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, frequency: 'custom' }} />)
    expect(screen.getByLabelText('반복 주기 (일)')).toBeInTheDocument()
    expect(screen.queryByLabelText('반복일')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('요일')).not.toBeInTheDocument()
  })

  // ==================== 빈도 변경 시 onFormChange 호출 ====================

  it('빈도 선택을 변경하면 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onFormChange={onFormChange} />)

    await user.selectOptions(screen.getByLabelText('반복 빈도'), 'weekly')
    expect(onFormChange).toHaveBeenCalled()
  })

  // ==================== 카테고리 필터링 ====================

  it('expense 타입일 때 expense 카테고리와 both 카테고리를 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    const categorySelect = screen.getByLabelText('카테고리')
    // 식비(expense) + 기타(both) = 2개 + 선택 안 함
    expect(categorySelect.querySelectorAll('option').length).toBe(3)
  })

  it('income 타입일 때 income 카테고리와 both 카테고리를 표시한다', () => {
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, type: 'income' }} />)
    const categorySelect = screen.getByLabelText('카테고리')
    // 급여(income) + 기타(both) = 2개 + 선택 안 함
    expect(categorySelect.querySelectorAll('option').length).toBe(3)
  })

  // ==================== 유형 전환 ====================

  it('수입 버튼 클릭 시 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onFormChange={onFormChange} />)

    await user.click(screen.getByText('수입'))
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', category_id: '' })
    )
  })

  it('지출 버튼 클릭 시 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} formData={{ ...emptyForm, type: 'income' }} onFormChange={onFormChange} />)

    await user.click(screen.getByText('지출'))
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', category_id: '' })
    )
  })

  // ==================== 종료일 ====================

  it('종료일 필드를 항상 표시한다', () => {
    render(<RecurringModal {...defaultProps} />)
    expect(screen.getByLabelText('종료일 (선택)')).toBeInTheDocument()
  })

  it('수정 모드에서도 종료일 필드를 표시한다', () => {
    render(<RecurringModal {...defaultProps} editingId={1} />)
    expect(screen.getByLabelText('종료일 (선택)')).toBeInTheDocument()
  })

  // ==================== 닫기/제출 ====================

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} />)
    await user.click(screen.getByLabelText('닫기'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('폼 제출 시 onSubmit을 호출한다', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onSubmit={onSubmit} />)
    await user.click(screen.getByText('추가하기'))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('제출 중이면 저장 버튼이 비활성화된다', () => {
    render(<RecurringModal {...defaultProps} submitting={true} />)
    const submitBtn = screen.getByText('저장 중...')
    expect(submitBtn).toBeDisabled()
  })

  // ==================== 필드 입력 ====================

  it('설명 필드 입력 시 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onFormChange={onFormChange} />)

    await user.type(screen.getByLabelText('설명'), 'A')
    expect(onFormChange).toHaveBeenCalled()
  })

  it('금액 필드 입력 시 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onFormChange={onFormChange} />)

    await user.type(screen.getByLabelText('금액'), '5')
    expect(onFormChange).toHaveBeenCalled()
  })

  it('카테고리 선택 시 onFormChange를 호출한다', async () => {
    const onFormChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurringModal {...defaultProps} onFormChange={onFormChange} />)

    await user.selectOptions(screen.getByLabelText('카테고리'), '1')
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: '1' })
    )
  })

  it('dialog role과 aria-modal 속성이 있다', () => {
    render(<RecurringModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
