/**
 * @file CardUsageSummary.test.tsx
 * @description 결제수단 실적 요약 컴포넌트 테스트 (#305)
 * monthly_target이 있는 결제수단의 프로그레스 바를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardUsageSummary from '../CardUsageSummary'
import type { PaymentMethodUsage } from '../../../types'

const mockUsage: PaymentMethodUsage[] = [
  {
    id: 1,
    name: '삼성카드',
    type: 'credit_card',
    monthly_target: 300000,
    spent_amount: 220000,
    usage_percentage: 73.3,
    remaining: 80000,
  },
  {
    id: 3,
    name: '국민카드',
    type: 'credit_card',
    monthly_target: 500000,
    spent_amount: 150000,
    usage_percentage: 30.0,
    remaining: 350000,
  },
]

function renderComponent(usage: PaymentMethodUsage[] = mockUsage) {
  return render(
    <MemoryRouter>
      <CardUsageSummary usage={usage} />
    </MemoryRouter>
  )
}

describe('CardUsageSummary', () => {
  it('결제수단 실적 섹션을 표시한다', () => {
    renderComponent()
    expect(screen.getByRole('heading', { name: /카드 실적/ })).toBeInTheDocument()
  })

  it('헤더에 이모지가 포함된다', () => {
    renderComponent()
    const heading = screen.getByRole('heading', { name: /카드 실적/ })
    expect(heading.textContent).toMatch(/💳/)
  })

  it('관리 링크를 표시한다', () => {
    renderComponent()
    expect(screen.getByRole('link', { name: '관리' })).toBeInTheDocument()
  })

  it('각 결제수단의 이름과 사용액을 표시한다', () => {
    renderComponent()
    expect(screen.getByText('삼성카드')).toBeInTheDocument()
    expect(screen.getByText('국민카드')).toBeInTheDocument()
  })

  it('달성률을 표시한다', () => {
    renderComponent()
    expect(screen.getByText('73.3%')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })

  it('빈 데이터면 null을 반환한다', () => {
    const { container } = renderComponent([])
    expect(container.firstChild).toBeNull()
  })

  it('monthly_target이 없는 항목은 포함되지 않는다', () => {
    const data: PaymentMethodUsage[] = [
      {
        id: 2,
        name: '현금',
        type: 'cash',
        monthly_target: null,
        spent_amount: 50000,
        usage_percentage: null,
        remaining: null,
      },
    ]
    const { container } = renderComponent(data)
    expect(container.firstChild).toBeNull()
  })
})
