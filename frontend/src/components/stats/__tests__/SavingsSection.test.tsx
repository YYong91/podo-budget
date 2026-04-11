import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SavingsSection from '../SavingsSection'

const mockSavingsCategories = [
  { category: '적금', amount: 300_000 },
  { category: '투자', amount: 180_000 },
  { category: '보험', amount: 50_000 },
]

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <SavingsSection
        savingsTotal={530_000}
        incomeTotal={3_500_000}
        savingsCategories={mockSavingsCategories}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('SavingsSection', () => {
  it('총 저축액을 표시한다', () => {
    renderSection()
    expect(screen.getByText('₩530,000')).toBeInTheDocument()
  })

  it('수입 대비 저축률을 표시한다', () => {
    renderSection()
    // 530_000 / 3_500_000 * 100 ≈ 15.1%
    expect(screen.getByText(/15\.1%/)).toBeInTheDocument()
  })

  it('카테고리별 내역을 표시한다', () => {
    renderSection()
    expect(screen.getByText('적금')).toBeInTheDocument()
    expect(screen.getByText('투자')).toBeInTheDocument()
    expect(screen.getByText('보험')).toBeInTheDocument()
  })

  it('savingsCategories가 없으면 설정 유도 메시지를 표시한다', () => {
    renderSection({ savingsCategories: [], savingsTotal: undefined })
    expect(screen.getByText(/저축 카테고리를 설정하면/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /카테고리 설정/ })).toBeInTheDocument()
  })
})
