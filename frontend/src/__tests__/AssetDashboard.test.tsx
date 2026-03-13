/* 자산 대시보드 컴포넌트 테스트 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import AssetDashboard from '../pages/AssetDashboard'
import { assetApi } from '../api/assets'

// chart.js는 jsdom에서 Canvas API 없으므로 모킹
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
}))

// HouseholdStore 모킹
vi.mock('../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({ activeHouseholdId: null }),
}))

// assets API 모킹
vi.mock('../api/assets', () => ({
  assetApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
    getSnapshots: vi.fn(),
    getGoal: vi.fn(),
    getMonthlySavings: vi.fn(),
    setGoal: vi.fn(),
    deleteGoal: vi.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAssets: any[] = [
  { id: 1, name: '삼성전자', type: 'stock_kr', is_liability: false, current_value: 700000, profit_loss_pct: 5.2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, name: '주담대', type: 'loan', is_liability: true, current_value: 200000000, interest_rate: 3.5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSummary: any = {
  total_assets: 700000,
  total_liabilities: 200000000,
  net_worth: -199300000,
  breakdown: { stock_kr: 700000 },
  total_profit_loss: 35000,
  total_profit_loss_pct: 5.2,
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AssetDashboard />
    </MemoryRouter>,
  )
}

describe('AssetDashboard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getAll).mockResolvedValue({ data: mockAssets } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getSummary).mockResolvedValue({ data: mockSummary } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getSnapshots).mockResolvedValue({ data: [] } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getGoal).mockResolvedValue({ data: null } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getMonthlySavings).mockResolvedValue({ data: { year: 2026, month: 3, total_income: 3000000, total_expense: 2500000, net_savings: 500000 } } as any)
  })

  test('로딩 후 순자산 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('순자산')).toBeInTheDocument()
    })
  })

  test('자산 목록 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })
  })

  test('부채 목록 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('주담대')).toBeInTheDocument()
    })
  })

  test('자산 등록 버튼 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('자산 등록')).toBeInTheDocument()
    })
  })

  test('목표 미설정 시 CTA 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('순자산 목표를 설정해보세요')).toBeInTheDocument()
    })
  })

  test('빈 상태: 자산 없을 때 CTA 표시', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getAll).mockResolvedValueOnce({ data: [] } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getSummary).mockResolvedValueOnce({ data: { total_assets: 0, total_liabilities: 0, net_worth: 0, breakdown: {}, total_profit_loss: null, total_profit_loss_pct: null } } as any)
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('첫 자산 등록하기')).toBeInTheDocument()
    })
  })

  test('API 오류 시 에러 메시지 표시', async () => {
    vi.mocked(assetApi.getAll).mockRejectedValueOnce(new Error('Network error'))
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('자산 정보를 불러오지 못했습니다')).toBeInTheDocument()
    })
  })
})
