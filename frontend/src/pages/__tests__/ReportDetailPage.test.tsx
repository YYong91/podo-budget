import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import { mockStructuredInsights } from '../../mocks/fixtures'
import ReportDetailPage from '../ReportDetailPage'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: (s: { activeHouseholdId: number }) => unknown) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

// currentMonthKst를 모킹하여 테스트 시점을 2026-04로 고정
// (미래 월 방지 조건 테스트에서 제어 가능하도록)
vi.mock('../../utils/monthUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/monthUtils')>(
    '../../utils/monthUtils',
  )
  return {
    ...actual,
    currentMonthKst: vi.fn(() => '2026-04'),
  }
})

function makeWrapper(month: string) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <MemoryRouter initialEntries={[`/insights/reports/${month}`]}>
        <Routes>
          <Route path="/insights/reports/:month" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completed 리포트의 핵심 발견이 표시된다', async () => {
    render(makeWrapper('2026-03'))
    // MSW 핸들러: findings[0].what = '식비가 전체 지출의 37.5%를 차지합니다'
    expect(await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')).toBeInTheDocument()
  })

  it('뒤로가기 버튼이 있다', async () => {
    render(makeWrapper('2026-03'))
    expect(await screen.findByText('모아보기로')).toBeInTheDocument()
  })

  describe('이전/다음 달 네비게이션', () => {
    it('completed 리포트 + prev completed → 이전 달 링크가 표시된다', async () => {
      // 2026-03 조회 시 이전 달 2026-02도 completed
      render(makeWrapper('2026-03'))
      await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')

      // "← 2026년 2월 리포트" 링크 표시
      expect(await screen.findByText('← 2026년 2월 리포트')).toBeInTheDocument()
    })

    it('completed 리포트 + next completed + 현재 월 이하 → 다음 달 링크가 표시된다', async () => {
      // 2026-03 조회 시 다음 달 2026-04도 completed, currentMonthKst는 2026-04로 모킹
      render(makeWrapper('2026-03'))
      await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')

      // "2026년 4월 리포트 →" 링크 표시
      expect(await screen.findByText('2026년 4월 리포트 →')).toBeInTheDocument()
    })

    it('completed 리포트 + prev pending → 이전 달 링크가 없다', async () => {
      // 2026-01 조회 시 이전 달 2025-12는 pending
      render(makeWrapper('2026-01'))
      await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')

      // 이전 달 2025-12는 pending이므로 링크 없음
      expect(screen.queryByText(/2025년 12월 리포트/)).not.toBeInTheDocument()
    })

    it('completed 리포트 + prev 없음(null) → 이전 달 링크가 없다', async () => {
      // 2026-03 completed 리포트를 조회하되,
      // 이전 달 2026-02가 null report인 시나리오를 server.use()로 오버라이드
      server.use(
        http.get('/api/reports/monthly', ({ request }) => {
          const url = new URL(request.url)
          const month = url.searchParams.get('month')
          if (month === '2026-02') {
            return HttpResponse.json({
              report: null,
              eligibility: {
                is_eligible: false,
                reason: '거래 데이터가 부족합니다',
                transaction_count: 0,
                required_count: 5,
              },
            })
          }
          // 나머지는 기본 핸들러에 위임하지 않으므로 2026-03 completed 직접 반환
          return HttpResponse.json({
            report: {
              id: 1,
              month: '2026-03',
              status: 'completed',
              insights: mockStructuredInsights,
              completed_at: '2026-04-01T03:30:00Z',
            },
            eligibility: null,
          })
        }),
      )

      render(makeWrapper('2026-03'))
      // completed 리포트가 렌더링될 때까지 대기 (이전 달 null → 이전 달 링크 없음)
      await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')

      // 이전 달 2026-02는 null이므로 이전 달 링크 없음
      expect(screen.queryByText(/← 2026년 2월 리포트/)).not.toBeInTheDocument()
    })

    it('completed 리포트 + next가 미래 월 → 다음 달 링크가 없다', async () => {
      // currentMonthKst가 2026-04로 모킹됨
      // 2026-04 리포트를 보면 다음 달 2026-05는 미래이므로 링크 없음
      render(makeWrapper('2026-04'))
      await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')

      // 다음 달 2026-05는 미래이므로 링크 없음
      expect(screen.queryByText(/2026년 5월 리포트/)).not.toBeInTheDocument()
    })

    it('pending 리포트 → 네비게이션 전체가 없다', async () => {
      // 2025-12는 pending 리포트
      render(makeWrapper('2025-12'))
      // pending 상태이면 ReportPendingState 표시, nav 쿼리 미실행
      // pending 리포트엔 ReportPendingState가 렌더링됨
      expect(screen.queryByText(/← .* 리포트/)).not.toBeInTheDocument()
      expect(screen.queryByText(/.* 리포트 →/)).not.toBeInTheDocument()
    })
  })
})
