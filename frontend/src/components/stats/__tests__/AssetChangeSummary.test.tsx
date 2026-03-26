import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetChangeSummary from '../AssetChangeSummary'

describe('AssetChangeSummary', () => {
  const mockSummary = {
    net_worth: 85000000,
    total_assets: 100000000,
    total_liabilities: 15000000,
    breakdown: { stock_kr: 30000000, deposit: 50000000, real_estate: 20000000 },
    total_profit_loss: 2000000,
    total_profit_loss_pct: 2.4,
  }

  const mockPrevSnapshot = {
    snapshot_date: '2026-02-28',
    total_assets: 97000000,
    total_liabilities: 14000000,
    net_worth: 83000000,
    breakdown: { stock_kr: 28000000, deposit: 49000000, real_estate: 20000000 },
  }

  it('순자산과 변화액을 표시한다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={mockSummary} previousSnapshot={mockPrevSnapshot} />
      </MemoryRouter>,
    )
    expect(screen.getByText('자산 변화')).toBeInTheDocument()
    // 순자산 8500만원 표시
    expect(screen.getByText(/8,500만원/)).toBeInTheDocument()
  })

  it('summary가 null이면 CTA를 표시한다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={null} previousSnapshot={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/자산을 등록/)).toBeInTheDocument()
  })

  it('previousSnapshot이 없으면 변화율을 표시하지 않는다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={mockSummary} previousSnapshot={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText('자산 변화')).toBeInTheDocument()
    expect(screen.queryByText(/지난달 대비/)).not.toBeInTheDocument()
  })
})
