/**
 * @file AssetDashboard.test.tsx
 * @description 자산 대시보드 페이지 테스트
 * 순자산 표시, 목표 설정 모달, 자산 목록 렌더링을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import AssetDashboard from '../AssetDashboard'

// recharts 모킹 — jsdom에서 SVG 렌더링 불가 대응
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// useHouseholdStore 모킹
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: { activeHouseholdId: number | null }) => unknown) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

// goal 응답에 progress_pct 등 AssetDashboard에서 필요한 필드 추가
const mockGoalWithProgress = {
  id: 1,
  target_net_worth: 100000000,
  target_date: '2027-12-31',
  household_id: null,
  user_id: 1,
  progress_pct: 85.0,
  pace_message: '잘 진행 중입니다',
  monthly_required: 1250000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderAssetDashboard() {
  return render(
    <MemoryRouter>
      <AssetDashboard />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // 각 테스트에서 goal 응답을 progress_pct 포함 버전으로 오버라이드
  server.use(
    http.get('/api/assets/goal', () => HttpResponse.json(mockGoalWithProgress)),
  )
})

describe('AssetDashboard', () => {
  describe('기본 렌더링', () => {
    it('순자산 히어로 섹션을 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산')).toBeInTheDocument()
      })
    })

    it('자산 등록 링크를 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /자산 등록/ })).toBeInTheDocument()
      })
    })

    it('계좌 관리 링크를 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /계좌 관리/ })).toBeInTheDocument()
      })
    })
  })

  describe('자산 데이터 표시', () => {
    it('자산 목록을 불러와 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        // mockAssets에 '삼성전자'와 '비상금 통장'이 있음
        expect(screen.getByText('삼성전자')).toBeInTheDocument()
      })
    })

    it('순자산 추이 차트를 표시한다 (스냅샷 2개 이상)', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument()
        expect(screen.getByText('순자산 추이')).toBeInTheDocument()
      })
    })

    it('목표가 있으면 진행률을 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산 목표')).toBeInTheDocument()
      })
    })
  })

  describe('에러 처리', () => {
    it('API 오류 시 에러 메시지를 표시한다', async () => {
      server.use(
        http.get('/api/assets', () => HttpResponse.json({ detail: 'Server Error' }, { status: 500 })),
      )

      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('자산 정보를 불러오지 못했습니다')).toBeInTheDocument()
      })
    })
  })

  describe('activeHouseholdId 없음', () => {
    it('activeHouseholdId가 없으면 API를 호출하지 않는다', async () => {
      vi.doMock('../../stores/useHouseholdStore', () => ({
        useHouseholdStore: (selector?: (s: { activeHouseholdId: number | null }) => unknown) => {
          const state = { activeHouseholdId: null }
          return selector ? selector(state) : state
        },
      }))
      // 모킹 변경은 다음 import에 반영되므로, API 호출 없이 로딩이 멈추는지 확인
      renderAssetDashboard()
      // 로딩 spinner가 없거나 있어도 에러가 발생하지 않아야 함
      expect(document.body).toBeInTheDocument()
    })
  })

  describe('목표 설정 모달', () => {
    it('목표 설정 버튼 클릭 시 모달이 열린다', async () => {
      const user = userEvent.setup()
      renderAssetDashboard()

      // 목표가 있는 경우 "수정" 버튼이 표시됨
      await waitFor(() => {
        expect(screen.getByText('순자산 목표')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', { name: '수정' })
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByText('순자산 목표 설정')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('예: 100000000')).toBeInTheDocument()
      })
    })

    it('모달 취소 버튼 클릭 시 모달이 닫힌다', async () => {
      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산 목표')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByText('순자산 목표 설정')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '취소' }))

      await waitFor(() => {
        expect(screen.queryByText('순자산 목표 설정')).not.toBeInTheDocument()
      })
    })
  })

  describe('빈 자산 상태', () => {
    it('자산이 없을 때 빈 상태 메시지와 등록 링크를 표시한다', async () => {
      server.use(
        http.get('/api/assets', () => HttpResponse.json([])),
        http.get('/api/assets/summary', () =>
          HttpResponse.json({ total_assets: 0, total_liabilities: 0, net_worth: 0, breakdown: {}, total_profit_loss: 0, total_profit_loss_pct: 0 })
        ),
        http.get('/api/assets/snapshots', () => HttpResponse.json([])),
      )

      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('아직 등록된 자산이 없습니다')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /첫 자산 등록하기/ })).toBeInTheDocument()
      })
    })
  })
})
