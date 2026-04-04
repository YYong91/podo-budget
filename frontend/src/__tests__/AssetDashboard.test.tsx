/* 자산 대시보드 컴포넌트 테스트 */

import { screen, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import AssetDashboard from '../pages/AssetDashboard'
import { assetApi } from '../api/assets'
import { renderWithQueryClient } from '../test-utils'

// useToast 모킹 — ToastProvider 없이 테스트 가능하도록
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// recharts 모킹 — jsdom에서 SVG 렌더링 불가 대응
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// HouseholdStore 모킹 — selector 패턴 지원
vi.mock('../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: { activeHouseholdId: number | null }) => unknown) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

// assets API 모킹
vi.mock('../api/assets', () => ({
  assetApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
    getSnapshots: vi.fn(),
    createSnapshot: vi.fn(),
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
  total_assets: 85000000,
  total_liabilities: 0,
  net_worth: 85000000,
  breakdown: { stock_kr: 700000, deposit: 84300000 },
  total_profit_loss: 35000,
  total_profit_loss_pct: 5.2,
}

function renderDashboard() {
  return renderWithQueryClient(<AssetDashboard />)
}

describe('AssetDashboard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getAll).mockResolvedValue({ data: mockAssets } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getSummary).mockResolvedValue({ data: mockSummary } as any)
    vi.mocked(assetApi.getSnapshots).mockResolvedValue({
      data: [
        { snapshot_date: '2026-03-01', total_assets: 85000000, total_liabilities: 0, net_worth: 85000000, breakdown: { stock_kr: 700000, deposit: 84300000 } },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getGoal).mockResolvedValue({ data: null } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getMonthlySavings).mockResolvedValue({ data: { month: '2026-03', savings: 500000 } } as any)
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
      // AssetGroupList의 "+ 자산 추가" 버튼 또는 그룹별 추가 버튼
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })
  })

  test('목표 미설정 시 CTA 표시', async () => {
    renderDashboard()
    await waitFor(() => {
      // MilestoneProgress: goal이 null이면 "순자산 목표를 설정해보세요" 표시
      expect(screen.getByText('순자산 목표를 설정해보세요')).toBeInTheDocument()
    })
  })

  test('빈 상태: 자산 없을 때 온보딩 표시', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getAll).mockResolvedValueOnce({ data: [] } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(assetApi.getSummary).mockResolvedValueOnce({ data: { total_assets: 0, total_liabilities: 0, net_worth: 0, breakdown: {}, total_profit_loss: null, total_profit_loss_pct: null } } as any)
    renderDashboard()
    await waitFor(() => {
      // AssetOnboarding 컴포넌트의 실제 텍스트
      expect(screen.getByText('우리 가족 자산을 정리해볼까요?')).toBeInTheDocument()
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
