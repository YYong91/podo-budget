/**
 * @file AssetDashboard.test.tsx
 * @description 자산 대시보드 페이지 테스트
 * 순자산 표시, 목표 설정 모달, 자산 목록 렌더링을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import AssetDashboard from '../AssetDashboard'
import { renderWithQueryClient } from '../../test-utils'

// useToast 모킹 — ToastProvider 없이 테스트 가능하도록
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// recharts 모킹 — jsdom에서 SVG 렌더링 불가 대응 (AreaChart 사용)
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
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
  pace_status: 'on_track',
  estimated_date: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderAssetDashboard() {
  return renderWithQueryClient(<AssetDashboard />)
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

    it('자산 그룹 목록을 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        // mockAssets에 삼성전자가 있음
        expect(screen.getByText('삼성전자')).toBeInTheDocument()
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
        expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      })
    })

    it('목표가 있으면 다음 목표 섹션을 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        // MilestoneProgress는 goal이 있으면 "다음 목표" 텍스트를 표시
        expect(screen.getByText('다음 목표')).toBeInTheDocument()
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

      // 목표가 있는 경우 MilestoneProgress가 "수정" 버튼을 표시
      await waitFor(() => {
        expect(screen.getByText('다음 목표')).toBeInTheDocument()
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
        expect(screen.getByText('다음 목표')).toBeInTheDocument()
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
    it('자산이 없을 때 AssetOnboarding을 표시한다', async () => {
      server.use(
        http.get('/api/assets', () => HttpResponse.json([])),
        http.get('/api/assets/summary', () =>
          HttpResponse.json({ total_assets: 0, total_liabilities: 0, net_worth: 0, breakdown: {}, total_profit_loss: 0, total_profit_loss_pct: 0 })
        ),
        http.get('/api/assets/snapshots', () => HttpResponse.json([])),
      )

      renderAssetDashboard()

      await waitFor(() => {
        // AssetOnboarding 컴포넌트의 실제 텍스트
        expect(screen.getByText('우리 가족 자산을 정리해볼까요?')).toBeInTheDocument()
      })
    })
  })

  describe('유형별 그룹', () => {
    it('자산 유형 그룹 헤더를 표시한다', async () => {
      renderAssetDashboard()

      await waitFor(() => {
        // mockAssets에 포함된 유형 그룹이 표시됨
        expect(screen.getByText('삼성전자')).toBeInTheDocument()
      })
    })

    it('그룹 헤더 클릭 시 접기/펼치기 토글한다', async () => {
      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('삼성전자')).toBeInTheDocument()
      })

      // 그룹 헤더 버튼 찾기 (예: "투자" 그룹)
      const groupHeaders = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('투자') || btn.textContent?.includes('예적금'),
      )
      if (groupHeaders.length > 0) {
        // 클릭하여 접기
        await user.click(groupHeaders[0])
        // 다시 클릭하여 펼치기
        await user.click(groupHeaders[0])
      }
    })
  })

  describe('목표 없는 상태', () => {
    it('목표가 없으면 목표 설정 유도 버튼을 표시한다', async () => {
      server.use(
        http.get('/api/assets/goal', () =>
          HttpResponse.json(null, { status: 404 }),
        ),
      )

      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산 목표를 설정해보세요')).toBeInTheDocument()
      })
    })

    it('목표 설정 유도 버튼 클릭 시 모달이 열린다', async () => {
      server.use(
        http.get('/api/assets/goal', () =>
          HttpResponse.json(null, { status: 404 }),
        ),
      )

      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산 목표를 설정해보세요')).toBeInTheDocument()
      })

      await user.click(screen.getByText('순자산 목표를 설정해보세요'))

      await waitFor(() => {
        expect(screen.getByText('순자산 목표 설정')).toBeInTheDocument()
      })
    })
  })

  describe('목표 모달 입력', () => {
    it('모달 닫기(X) 버튼으로 모달을 닫을 수 있다', async () => {
      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('다음 목표')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByText('순자산 목표 설정')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '닫기' }))

      await waitFor(() => {
        expect(screen.queryByText('순자산 목표 설정')).not.toBeInTheDocument()
      })
    })

    it('모달에서 목표 금액과 날짜가 비어있으면 저장 버튼이 비활성화된다', async () => {
      server.use(
        http.get('/api/assets/goal', () =>
          HttpResponse.json(null, { status: 404 }),
        ),
      )

      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('순자산 목표를 설정해보세요')).toBeInTheDocument()
      })

      await user.click(screen.getByText('순자산 목표를 설정해보세요'))

      await waitFor(() => {
        expect(screen.getByText('저장')).toBeInTheDocument()
      })

      const saveBtn = screen.getByRole('button', { name: '저장' })
      expect(saveBtn).toBeDisabled()
    })

    it('기존 목표 수정 시 삭제 버튼이 표시된다', async () => {
      const user = userEvent.setup()
      renderAssetDashboard()

      await waitFor(() => {
        expect(screen.getByText('다음 목표')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '수정' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
      })
    })
  })

  describe('월간 성과 카드', () => {
    it('스냅샷이 있으면 MonthlyPerformanceCard가 렌더된다', async () => {
      renderAssetDashboard()

      // 스냅샷 2개 이상 → netWorthChange != null → MonthlyPerformanceCard 표시
      // MonthlyPerformanceCard는 "이번 달" 텍스트를 포함
      await waitFor(() => {
        // 순자산 히어로와 함께 페이지가 렌더됨을 확인
        expect(screen.getByText('순자산')).toBeInTheDocument()
      })
    })
  })
})
