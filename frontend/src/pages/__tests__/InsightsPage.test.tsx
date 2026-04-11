import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import InsightsPage from '../InsightsPage'
import { FEATURES } from '../../config/features'


vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
}))

// useToast 모킹 (react-hot-toast 대신 커스텀 훅 사용)
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// React Query 테스트용 클라이언트 (재시도 비활성화 — 테스트 속도 향상)
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InsightsPage', () => {
  beforeEach(() => {
    localStorage.removeItem('podo-insights-sections')
  })

  it('로딩 완료 후 종합 요약 카드를 표시한다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })
    expect(screen.getAllByText('총 지출').length).toBeGreaterThan(0)
  })

  it('월 네비게이션이 표시된다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      const now = new Date()
      expect(screen.getByText(`${now.getMonth() + 1}월`)).toBeInTheDocument()
    })
  })

  it('지출 카테고리가 표시된다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('지출 카테고리')).toBeInTheDocument()
    })
  })

  it('AI 상세 분석 버튼이 표시된다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('AI 상세 분석')).toBeInTheDocument()
    })
    expect(screen.getByText('분석하기')).toBeInTheDocument()
  })

  it('AI 분석 버튼 클릭 시 로딩 후 결과가 표시된다', async () => {
    const user = userEvent.setup()
    renderWithQuery(<InsightsPage />)

    await waitFor(() => {
      expect(screen.getByText('분석하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('분석하기'))

    await waitFor(() => {
      // 구조화된 인사이트가 표시됨
      expect(screen.getByText('핵심 발견')).toBeInTheDocument()
    })
  })

  it('주간/연간 토글이 없다 (월간 전용)', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.queryByText('주간')).not.toBeInTheDocument()
      expect(screen.queryByText('연간')).not.toBeInTheDocument()
    })
  })

  it('로딩 중 스켈레톤 UI를 표시한다', () => {
    renderWithQuery(<InsightsPage />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('API 에러 시 에러 상태를 표시한다', async () => {
    server.use(
      http.get('/api/expenses/stats', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/income/stats', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/expenses/stats/comparison', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/income/stats/comparison', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/budgets/stats/monthly', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/assets/summary', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
      http.get('/api/assets/snapshots', () => {
        return HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
      }),
    )

    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('주목할 점이 카테고리 TOP보다 먼저 표시된다', async () => {
    // 지출 10% 이상 감소 시 하이라이트 노출 — comparison 핸들러를 오버라이드
    server.use(
      http.get('*/expenses/stats/comparison', () =>
        HttpResponse.json({
          current: { label: '2024년 1월', total: 50000 },
          previous: { label: '2023년 12월', total: 60000 },
          change: { amount: -10000, percentage: -16.7 },
          trend: [],
          by_category_comparison: [],
        })
      )
    )
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText(/이번 달 주목할 점/)).toBeInTheDocument()
    })

    const highlights = screen.getByText(/이번 달 주목할 점/)
    const categoryTop = screen.getByText('지출 카테고리')

    // 주목할 점이 카테고리 TOP보다 DOM에서 먼저 나온다
    expect(highlights.compareDocumentPosition(categoryTop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('총 수입 카드에 전월 대비 변화율(ChangeIndicator)을 표시하지 않는다', async () => {
    // ChangeIndicator 제거 — 수입/지출 카드에 "지난달 %" 텍스트 없음
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })
    expect(screen.queryByText(/지난달/)).not.toBeInTheDocument()
  })

  it('예산 상황 섹션에 편집 링크가 표시된다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('budget-vs-actual')).toBeInTheDocument()
    })

    const budgetSection = screen.getByTestId('budget-vs-actual')
    const editLink = budgetSection.querySelector('a[href="/budgets"]')
    expect(editLink).toBeInTheDocument()
  })

  // ── 섹션 토글 커스터마이징 ──

  it('설정(톱니바퀴) 아이콘이 표시된다', async () => {
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('섹션 설정')).toBeInTheDocument()
  })

  it('설정 아이콘 클릭 시 섹션 토글 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByLabelText('섹션 설정')).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('섹션 설정'))

    expect(screen.getByText('섹션 표시 설정')).toBeInTheDocument()
    // 히어로 + 요약 카드는 비활성 토글로 표시
    // 모달 내부에서 섹션 라벨 확인 (페이지 본문에도 같은 텍스트가 있으므로 모달 기준으로 검색)
    const modal = screen.getByText('섹션 표시 설정').closest('div.relative')!
    expect(modal).toHaveTextContent('히어로 + 요약 카드')
    expect(modal).toHaveTextContent('이달의 주목할 점')
    expect(modal).toHaveTextContent('변동 지출 (카테고리)')
    expect(modal).toHaveTextContent('변동 지출 (예산)')
    // 자산 섹션은 FEATURES.assets 플래그에 따라 조건부 표시
    if (FEATURES.assets) {
      expect(modal).toHaveTextContent('자산 변화')
    } else {
      expect(modal).not.toHaveTextContent('자산 변화')
    }
    expect(modal).toHaveTextContent('AI 종합 분석')
  })

  it('섹션 토글을 끄면 해당 섹션이 숨겨진다', async () => {
    const user = userEvent.setup()
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByLabelText('섹션 설정')).toBeInTheDocument()
    })

    // 설정 모달 열기
    await user.click(screen.getByLabelText('섹션 설정'))
    expect(screen.getByText('섹션 표시 설정')).toBeInTheDocument()

    // '변동 지출 (카테고리)' 토글 끄기
    const categoryToggle = screen.getByRole('checkbox', { name: '변동 지출 (카테고리)' })
    await user.click(categoryToggle)

    // 모달 닫기
    await user.click(screen.getByLabelText('설정 닫기'))

    // 해당 섹션이 더 이상 표시되지 않는다
    await waitFor(() => {
      expect(screen.queryByText('변동 지출 (카테고리)')).not.toBeInTheDocument()
    })
  })

  it('설정이 localStorage에 저장된다', async () => {
    const user = userEvent.setup()
    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByLabelText('섹션 설정')).toBeInTheDocument()
    })

    // 설정 모달 열기
    await user.click(screen.getByLabelText('섹션 설정'))

    // '변동 지출 (예산)' 토글 끄기
    const budgetToggle = screen.getByRole('checkbox', { name: '변동 지출 (예산)' })
    await user.click(budgetToggle)

    // 모달 닫기
    await user.click(screen.getByLabelText('설정 닫기'))

    // localStorage에 저장됨
    const stored = JSON.parse(localStorage.getItem('podo-insights-sections') ?? '{}')
    expect(stored.budget).toBe(false)
    // 다른 섹션은 true 유지
    expect(stored.highlights).toBe(true)
    expect(stored.categoryTop).toBe(true)
  })

  it('페이지 재방문 시 저장된 설정이 복원된다', async () => {
    // localStorage에 미리 설정 저장 (highlights OFF)
    localStorage.setItem('podo-insights-sections', JSON.stringify({
      highlights: false,
      categoryTop: true,
      budget: true,
      assets: true,
      ai: true,
    }))

    renderWithQuery(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })

    // 주목할 점 섹션이 숨겨져 있다
    expect(screen.queryByText(/이번 달 주목할 점/)).not.toBeInTheDocument()
    // 다른 섹션은 정상 표시
    expect(screen.getByText('지출 카테고리')).toBeInTheDocument()
  })
})
