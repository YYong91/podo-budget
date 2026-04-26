import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MonthlyReportCard from '../MonthlyReportCard'

vi.mock('../../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

describe('MonthlyReportCard', () => {
  it('completed 리포트가 있으면 카드 헤드라인이 표시된다', async () => {
    render(<MonthlyReportCard />, { wrapper })
    // MSW 핸들러가 mockStructuredInsights.findings[0].what 반환
    expect(await screen.findByText(/식비가 전체 지출의 37\.5%를 차지합니다/)).toBeInTheDocument()
  })
})
