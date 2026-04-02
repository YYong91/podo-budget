import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MilestoneProgress, { computeMilestone } from '../MilestoneProgress'

describe('computeMilestone', () => {
  it('1억 미만: 500만원 단위', () => {
    const m = computeMilestone(43000000)
    expect(m).not.toBeNull()
    expect(m!.unit).toBe(5000000)
    expect(m!.next).toBe(45000000)
    expect(m!.prev).toBe(40000000)
    expect(m!.progressPct).toBeCloseTo(60)
  })

  it('1억~5억: 1000만원 단위', () => {
    const m = computeMilestone(234000000)
    expect(m).not.toBeNull()
    expect(m!.unit).toBe(10000000)
    expect(m!.next).toBe(240000000)
    expect(m!.prev).toBe(230000000)
  })

  it('5억 이상: 5000만원 단위', () => {
    const m = computeMilestone(520000000)
    expect(m).not.toBeNull()
    expect(m!.unit).toBe(50000000)
    expect(m!.next).toBe(550000000)
  })

  it('정확히 경계값이면 다음 단위로 전진', () => {
    const m = computeMilestone(250000000)
    expect(m).not.toBeNull()
    expect(m!.next).toBe(260000000)
    expect(m!.prev).toBe(250000000)
  })

  it('순자산 0 이하면 null 반환', () => {
    expect(computeMilestone(0)).toBeNull()
    expect(computeMilestone(-5000000)).toBeNull()
  })
})

describe('MilestoneProgress', () => {
  it('마일스톤 프로그레스 바를 표시한다', () => {
    render(<MilestoneProgress netWorth={234000000} goal={{ target_net_worth: 1000000000, target_date: '2030-12-31' }} onGoalEdit={() => {}} />)
    expect(screen.getByText(/다음 목표/)).toBeInTheDocument()
    expect(screen.getByText(/2억 4,000만원/)).toBeInTheDocument()
  })

  it('순자산 0 이하면 렌더링하지 않는다', () => {
    const { container } = render(<MilestoneProgress netWorth={-100} goal={null} onGoalEdit={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('목표 미설정 시 CTA를 표시한다', () => {
    render(<MilestoneProgress netWorth={100000000} goal={null} onGoalEdit={() => {}} />)
    expect(screen.getByText(/순자산 목표를 설정/)).toBeInTheDocument()
  })
})
