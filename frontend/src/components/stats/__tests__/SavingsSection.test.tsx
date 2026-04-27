import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('저축/고정/변동 비율을 표시한다', () => {
    renderSection()
    // 530_000 / 3_500_000 * 100 ≈ 15.1%
    expect(screen.getByText(/저축 15\.1%/)).toBeInTheDocument()
  })

  it('savingsCategories가 없으면 설정 유도 메시지를 표시한다', () => {
    renderSection({ savingsCategories: [], savingsTotal: undefined })
    expect(screen.getByText(/저축 카테고리를 설정하면/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /카테고리 설정/ })).toBeInTheDocument()
  })

  it('관리 링크를 표시한다', () => {
    renderSection()
    expect(screen.getByRole('link', { name: '관리' })).toBeInTheDocument()
  })

  it('저축 카테고리가 1개여도 접기/펼치기 버튼을 표시한다', () => {
    renderSection({
      savingsCategories: [{ category: '적금', amount: 300000 }],
      savingsTotal: 300000,
    })
    // 항상 collapsible → 1개여도 펼치기 버튼 표시
    expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
    // 기본 접힌 상태 → breakdown 미표시
    expect(screen.queryByText('적금')).not.toBeInTheDocument()
  })

  // 카드명 변경 확인
  it('카드 제목이 "지출 구성"이다', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: /지출 구성/ })).toBeInTheDocument()
  })

  // stacked bar 렌더 확인
  it('수입이 있을 때 stacked bar를 표시한다', () => {
    renderSection({ recurringTotal: 800000, expenseTotal: 1800000 })
    expect(screen.getByTestId('income-flow-bar')).toBeInTheDocument()
  })

  // incomeTotal === 0 케이스
  it('수입이 0이면 stacked bar를 표시하지 않는다', () => {
    renderSection({ incomeTotal: 0, recurringTotal: 0, expenseTotal: 0 })
    expect(screen.queryByTestId('income-flow-bar')).not.toBeInTheDocument()
  })

  // collapsible 분기 — 카테고리 2개 이상: 펼치기 가능
  it('카테고리 2개 이상이면 펼치기 버튼을 표시한다', () => {
    renderSection()  // mockSavingsCategories가 3개
    expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
  })

  // 카테고리 1개: 항상 collapsible, 버튼 있음
  it('카테고리 1개이면 펼치기 버튼을 표시한다', () => {
    renderSection({
      savingsCategories: [{ category: '적금', amount: 300000 }],
      savingsTotal: 300000,
    })
    expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
  })

  // 기본 접힘 상태 (2개 이상인 경우)
  it('기본 접힌 상태에서는 카테고리 breakdown을 표시하지 않는다', () => {
    renderSection()
    expect(screen.queryByText('적금')).not.toBeInTheDocument()
  })

  it('펼치기 클릭 시 카테고리 breakdown을 표시한다', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(screen.getByText('적금')).toBeInTheDocument()
  })

  // 기존 '카테고리별 내역을 표시한다' 교체
  it('펼쳤을 때 카테고리별 내역을 표시한다', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    // mockSavingsCategories: 적금, 투자, 보험
    expect(screen.getByText('적금')).toBeInTheDocument()
    expect(screen.getByText('투자')).toBeInTheDocument()
    expect(screen.getByText('보험')).toBeInTheDocument()
  })
})
