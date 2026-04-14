/**
 * @file CardUsageSummary.test.tsx
 * @description 결제수단 실적 요약 컴포넌트 테스트 (#305)
 * monthly_target이 있는 결제수단의 프로그레스 바를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('펼쳤을 때 각 결제수단의 이름과 사용액을 표시한다', async () => {
    renderComponent()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(screen.getByText('삼성카드')).toBeInTheDocument()
    expect(screen.getByText('국민카드')).toBeInTheDocument()
  })

  it('펼쳤을 때 달성률을 표시한다', async () => {
    renderComponent()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(screen.getByText('73.3%')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })

  // 기본 접힌 상태 검증
  it('기본 접힌 상태에서 카드별 상세 프로그레스를 표시하지 않는다', () => {
    renderComponent()
    expect(screen.queryByText('73.3%')).not.toBeInTheDocument()
  })

  it('접힌 상태에서 달성/진행 오버뷰를 표시한다', () => {
    renderComponent()
    // mockUsage: 2개 카드, 둘 다 미달성 (사용 percentage < 100)
    expect(screen.getByText(/진행 중 2개/)).toBeInTheDocument()
  })

  it('달성한 카드가 있으면 달성 건수를 오버뷰에 표시한다', () => {
    const achievedUsage: PaymentMethodUsage[] = [
      { id: 1, name: '삼성카드', type: 'credit_card', monthly_target: 300000,
        spent_amount: 310000, usage_percentage: 103.3, remaining: 0 },
      { id: 2, name: '국민카드', type: 'credit_card', monthly_target: 200000,
        spent_amount: 60000, usage_percentage: 30.0, remaining: 140000 },
    ]
    renderComponent(achievedUsage)
    expect(screen.getByText(/달성 1개/)).toBeInTheDocument()
    expect(screen.getByText(/진행 중 1개/)).toBeInTheDocument()
  })

  it('카드 1개 달성 시 "✅ 실적 달성"을 오버뷰에 표시한다', () => {
    const achievedUsage: PaymentMethodUsage[] = [
      { id: 1, name: '삼성카드', type: 'credit_card', monthly_target: 300000,
        spent_amount: 310000, usage_percentage: 103.3, remaining: 0 },
    ]
    renderComponent(achievedUsage)
    expect(screen.getByText(/실적 달성/)).toBeInTheDocument()
  })

  it('펼치기 클릭 시 카드별 상세 프로그레스가 표시된다', async () => {
    renderComponent()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(screen.getByText('삼성카드')).toBeInTheDocument()
    expect(screen.getByText('73.3%')).toBeInTheDocument()
  })

  it('카드 1개일 때 접힌 오버뷰에 해당 카드 이름과 달성률을 표시한다', () => {
    renderComponent([mockUsage[0]])  // 삼성카드만 (usage_percentage: 73.3)
    expect(screen.getByText(/삼성카드/)).toBeInTheDocument()
    expect(screen.getByText(/73.3%/)).toBeInTheDocument()
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
