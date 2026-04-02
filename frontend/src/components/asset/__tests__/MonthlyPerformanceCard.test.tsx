import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MonthlyPerformanceCard, { computeBreakdownDiff, computeStreak } from '../MonthlyPerformanceCard'

describe('computeBreakdownDiff', () => {
  it('breakdown 차이를 올바르게 계산한다', () => {
    const current = { breakdown: { stock_kr: 7000000, deposit: 5500000 }, totalLiabilities: 78000000 }
    const previous = { breakdown: { stock_kr: 6800000, deposit: 5000000 }, totalLiabilities: 79000000 }
    const diff = computeBreakdownDiff(current, previous)
    expect(diff.find(d => d.label === '투자')?.amount).toBe(200000)
    expect(diff.find(d => d.label === '예적금')?.amount).toBe(500000)
    expect(diff.find(d => d.label === '대출 상환')?.amount).toBe(1000000) // 부호 반전
  })

  it('변화량 0인 항목은 제외한다', () => {
    const current = { breakdown: { stock_kr: 5000000 }, totalLiabilities: 78000000 }
    const previous = { breakdown: { stock_kr: 5000000 }, totalLiabilities: 78000000 }
    const diff = computeBreakdownDiff(current, previous)
    expect(diff).toHaveLength(0)
  })
})

describe('computeStreak', () => {
  it('연속 증가 개월 수를 계산한다', () => {
    const snapshots = [
      { net_worth: 200 },
      { net_worth: 190 },
      { net_worth: 180 },
    ] // 최신→과거
    expect(computeStreak(snapshots)).toBe(2)
  })

  it('감소가 있으면 스트릭이 끊긴다', () => {
    const snapshots = [
      { net_worth: 200 },
      { net_worth: 210 }, // 감소 (200 < 210)
      { net_worth: 180 },
    ]
    expect(computeStreak(snapshots)).toBe(0)
  })
})

describe('MonthlyPerformanceCard', () => {
  it('변화량을 표시한다', () => {
    render(
      <MonthlyPerformanceCard
        netWorthChange={480000}
        breakdownDiff={[{ label: '투자', amount: 320000 }, { label: '예적금', amount: 500000 }]}
        streak={3}
        savings={500000}
      />
    )
    expect(screen.getByText(/\+48만원/)).toBeInTheDocument()
  })

  it('스트릭 뱃지를 표시한다', () => {
    render(
      <MonthlyPerformanceCard netWorthChange={100000} breakdownDiff={[]} streak={3} savings={0} />
    )
    expect(screen.getByText(/3개월 연속/)).toBeInTheDocument()
  })
})
