import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NetWorthChart from '../NetWorthChart'
import type { AssetSnapshot } from '../../../types'

// recharts는 SVG 렌더링 — jsdom에서 ResponsiveContainer가 크기를 못 읽음
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-container">{children}</div>
    ),
  }
})

const makeSnapshot = (daysAgo: number, netWorth: number): AssetSnapshot => ({
  snapshot_date: new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0],
  net_worth: netWorth,
  total_assets: netWorth + 10000000,
  total_liabilities: 10000000,
  breakdown: {},
})

describe('NetWorthChart', () => {
  const snapshots: AssetSnapshot[] = [
    makeSnapshot(90, 40000000),
    makeSnapshot(60, 42000000),
    makeSnapshot(30, 44000000),
    makeSnapshot(0, 45000000),
  ]

  it('기간 탭이 렌더링된다', () => {
    render(<NetWorthChart snapshots={snapshots} />)
    expect(screen.getByRole('button', { name: '3M' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6M' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12M' })).toBeInTheDocument()
  })

  it('기간 탭 클릭 시 활성화된다', async () => {
    render(<NetWorthChart snapshots={snapshots} />)
    const btn6m = screen.getByRole('button', { name: '6M' })
    await userEvent.click(btn6m)
    expect(btn6m).toHaveClass('text-grape-600')
  })

  it('스냅샷이 없으면 빈 상태를 표시한다', () => {
    render(<NetWorthChart snapshots={[]} />)
    expect(screen.getByText(/다음 달부터 추이를 볼 수 있어요/)).toBeInTheDocument()
  })
})
