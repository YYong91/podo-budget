/**
 * @file TransactionItem.test.tsx
 * @description 거래 항목 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TransactionItem from '../TransactionItem'
import { mockCategories } from '../../mocks/fixtures'

function renderItem(props: Partial<React.ComponentProps<typeof TransactionItem>> = {}) {
  const defaultProps = {
    id: 1,
    type: 'expense' as const,
    description: '김치찌개',
    amount: 8000,
    categoryId: 1,
    categories: mockCategories,
    onCategoryClick: vi.fn(),
    ...props,
  }
  return render(
    <MemoryRouter>
      <TransactionItem {...defaultProps} />
    </MemoryRouter>,
  )
}

describe('TransactionItem', () => {
  it('지출 항목의 설명과 금액을 렌더링한다', () => {
    renderItem()
    expect(screen.getByText('김치찌개')).toBeInTheDocument()
    // 금액은 '-' + formatAmount(8000) → '-₩8,000' 형태로 렌더링됨
    expect(screen.getByText(/-₩8,000/)).toBeInTheDocument()
  })

  it('수입 항목은 + 부호와 함께 표시한다', () => {
    renderItem({ type: 'income', description: '월급', amount: 3000000 })
    expect(screen.getByText('월급')).toBeInTheDocument()
    expect(screen.getByText(/\+₩3,000,000/)).toBeInTheDocument()
  })

  it('카테고리 이름을 표시한다', () => {
    renderItem({ categoryId: 1 })
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it('카테고리가 없으면 미분류를 표시한다', () => {
    renderItem({ categoryId: null })
    expect(screen.getByText('미분류')).toBeInTheDocument()
  })

  it('지출은 /expenses/:id 링크를 렌더링한다', () => {
    renderItem({ id: 5, type: 'expense' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/expenses/5')
  })

  it('수입은 /income/:id 링크를 렌더링한다', () => {
    renderItem({ id: 3, type: 'income' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/income/3')
  })

  it('카테고리 버튼 클릭 시 onCategoryClick을 호출한다', async () => {
    const user = userEvent.setup()
    const onCategoryClick = vi.fn()
    renderItem({ onCategoryClick })
    await user.click(screen.getByText('식비'))
    expect(onCategoryClick).toHaveBeenCalledTimes(1)
  })

  it('정기 거래는 "정기" 뱃지를 표시한다', () => {
    renderItem({ rawInput: '[정기] 넷플릭스' })
    expect(screen.getByText('정기')).toBeInTheDocument()
  })

  it('통계 제외 항목은 "통계제외" 뱃지를 표시한다', () => {
    renderItem({ excludeFromStats: true })
    expect(screen.getByText('통계제외')).toBeInTheDocument()
  })

  it('통계 제외 항목은 opacity가 적용된다', () => {
    renderItem({ excludeFromStats: true })
    const link = screen.getByRole('link')
    expect(link.className).toContain('opacity-50')
  })
})
