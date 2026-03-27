/**
 * @file RegisterRecurringModal.test.tsx
 * @description 반복 거래 등록 모달 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterRecurringModal from '../RegisterRecurringModal'
import { mockCategories } from '../../mocks/fixtures'

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

function renderModal(props: Partial<React.ComponentProps<typeof RegisterRecurringModal>> = {}) {
  const defaultProps = {
    type: 'expense' as const,
    amount: 17000,
    description: '넷플릭스',
    category_id: 1,
    categories: mockCategories,
    initialDate: '2026-03-14T00:00:00Z',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  }
  return { ...render(<RegisterRecurringModal {...defaultProps} />), props: defaultProps }
}

describe('RegisterRecurringModal', () => {
  it('모달 제목을 렌더링한다', () => {
    renderModal()
    // 제목과 버튼 모두 "반복 거래 등록" 텍스트를 가짐
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('반복 거래 등록')
  })

  it('미리 채워진 거래 정보를 표시한다', () => {
    renderModal()
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('넷플릭스')).toBeInTheDocument()
    expect(screen.getByText('₩17,000')).toBeInTheDocument()
  })

  it('수입 타입을 올바르게 표시한다', () => {
    renderModal({ type: 'income' })
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('반복 주기 셀렉트를 렌더링한다', () => {
    renderModal()
    expect(screen.getByText('반복 주기')).toBeInTheDocument()
    expect(screen.getByDisplayValue('매월')).toBeInTheDocument()
  })

  it('월별 주기에서 반복 날짜 필드를 표시한다', () => {
    renderModal()
    expect(screen.getByText('반복 날짜')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose를 호출한다', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    // X 버튼 클릭
    const closeButtons = screen.getAllByRole('button')
    const closeBtn = closeButtons.find((b) => b.querySelector('svg'))!
    await user.click(closeBtn)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('등록 버튼이 렌더링된다', () => {
    renderModal()
    expect(screen.getByRole('button', { name: '반복 거래 등록' })).toBeInTheDocument()
  })

  it('폼 제출 시 API를 호출하고 성공 콜백을 실행한다', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    const submitBtn = screen.getByRole('button', { name: '반복 거래 등록' })
    await user.click(submitBtn)
    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('시작일과 종료일 필드를 렌더링한다', () => {
    renderModal()
    expect(screen.getByText('시작일')).toBeInTheDocument()
    expect(screen.getByText('종료일 (선택)')).toBeInTheDocument()
  })

  it('주간 주기 선택 시 요일 필드를 표시한다', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'weekly')
    expect(screen.getByText('요일')).toBeInTheDocument()
    expect(screen.queryByText('반복 날짜')).not.toBeInTheDocument()
  })

  it('연간 주기 선택 시 반복 날짜와 반복 월 필드를 표시한다', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'yearly')
    expect(screen.getByText('반복 날짜')).toBeInTheDocument()
    expect(screen.getByText('반복 월')).toBeInTheDocument()
  })

  it('사용자 지정 주기 선택 시 반복 주기 필드를 표시한다', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'custom')
    expect(screen.getAllByText('반복 주기').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('일마다')).toBeInTheDocument()
  })

  it('category_id가 없으면 카테고리 행을 표시하지 않는다', () => {
    renderModal({ category_id: null })
    expect(screen.queryByText('카테고리')).not.toBeInTheDocument()
  })

  it('카테고리가 있으면 카테고리 이름을 표시한다', () => {
    renderModal({ category_id: 1, categories: mockCategories })
    expect(screen.getByText('카테고리')).toBeInTheDocument()
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it('주간 주기로 폼 제출이 성공한다', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'weekly')
    await user.click(screen.getByRole('button', { name: '반복 거래 등록' }))
    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('연간 주기로 폼 제출이 성공한다', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'yearly')
    await user.click(screen.getByRole('button', { name: '반복 거래 등록' }))
    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('사용자 지정 주기로 폼 제출이 성공한다', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'custom')
    await user.click(screen.getByRole('button', { name: '반복 거래 등록' }))
    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('initialDate에서 반복 날짜를 추출한다', () => {
    renderModal({ initialDate: '2026-03-25' })
    // 25일이 반복 날짜로 설정됨
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
  })
})
