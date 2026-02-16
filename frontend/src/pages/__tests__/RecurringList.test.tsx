import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import RecurringList from '../RecurringList'

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

function renderRecurringList() {
  return render(
    <MemoryRouter>
      <RecurringList />
    </MemoryRouter>,
  )
}

describe('RecurringList', () => {
  it('페이지 제목을 표시한다', () => {
    renderRecurringList()
    expect(screen.getByText('정기 거래')).toBeInTheDocument()
  })

  it('정기 거래 목록을 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('급여').length).toBeGreaterThan(0)
  })

  it('빈도를 한국어로 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getAllByText('매월 25일').length).toBeGreaterThan(0)
    })
  })

  it('전체/지출/수입 필터 탭이 있다', () => {
    renderRecurringList()
    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('지출 탭 클릭 시 지출만 표시한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/recurring', ({ request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type')
        if (type === 'expense') {
          return HttpResponse.json([{
            id: 1, user_id: 1, household_id: null,
            type: 'expense', amount: 17000, description: '넷플릭스',
            category_id: null, frequency: 'monthly', interval: null,
            day_of_month: 25, day_of_week: null, month_of_year: null,
            start_date: '2026-01-25', end_date: null,
            next_due_date: '2026-02-25', is_active: true,
            created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
          }])
        }
        return HttpResponse.json([])
      }),
    )
    renderRecurringList()
    await user.click(screen.getByText('지출'))
    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })
  })

  it('빈 목록일 때 빈 상태를 표시한다', async () => {
    server.use(http.get('/api/recurring', () => HttpResponse.json([])))
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByText(/등록된 정기 거래가 없습니다/)).toBeInTheDocument()
    })
  })

  it('에러 발생 시 에러 상태를 표시한다', async () => {
    server.use(http.get('/api/recurring', () => HttpResponse.json({ detail: 'Error' }, { status: 500 })))
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
  })

  it('추가 버튼이 있다', () => {
    renderRecurringList()
    expect(screen.getByText('추가')).toBeInTheDocument()
  })

  it('추가 버튼 클릭 시 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderRecurringList()
    await user.click(screen.getByText('추가'))
    expect(screen.getByText('정기 거래 추가')).toBeInTheDocument()
  })

  it('활성/정지 상태 뱃지를 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      const badges = screen.getAllByText('활성')
      expect(badges.length).toBeGreaterThan(0)
    })
  })
})
