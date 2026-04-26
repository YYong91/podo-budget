import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportDetailPage from '../ReportDetailPage'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

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
  it('completed 리포트의 핵심 발견이 표시된다', async () => {
    render(makeWrapper('2026-03'))
    // MSW 핸들러: findings[0].what = '식비가 전체 지출의 37.5%를 차지합니다'
    expect(await screen.findByText('식비가 전체 지출의 37.5%를 차지합니다')).toBeInTheDocument()
  })

  it('뒤로가기 버튼이 있다', async () => {
    render(makeWrapper('2026-03'))
    expect(await screen.findByText('모아보기로')).toBeInTheDocument()
  })
})
