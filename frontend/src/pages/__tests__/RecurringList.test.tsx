/**
 * @file RecurringList.test.tsx
 * @description 반복 거래 관리 페이지 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import RecurringList from '../RecurringList'
import type { RecurringTransaction } from '../../types'

const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
}))

/** 테스트용 반복 거래 데이터 */
const mockItems: RecurringTransaction[] = [
  {
    id: 1, user_id: 1, household_id: 1,
    type: 'expense', amount: 17000, description: '넷플릭스',
    category_id: null, frequency: 'monthly', interval: null,
    day_of_month: 25, day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
    category_emoji: null,
  },
  {
    id: 2, user_id: 1, household_id: 1,
    type: 'income', amount: 3500000, description: '급여',
    category_id: null, frequency: 'monthly', interval: null,
    day_of_month: 25, day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
    category_emoji: null,
  },
  {
    id: 3, user_id: 1, household_id: 1,
    type: 'expense', amount: 50000, description: '정지된 거래',
    category_id: null, frequency: 'monthly', interval: null,
    day_of_month: 1, day_of_week: null, month_of_year: null,
    start_date: '2026-01-01', end_date: null,
    next_due_date: '2026-02-01', is_active: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    category_emoji: null,
  },
]

function renderRecurringList() {
  return render(
    <MemoryRouter>
      <RecurringList />
    </MemoryRouter>,
  )
}

describe('RecurringList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  // ==================== 기본 렌더링 ====================

  it('필터 탭을 표시한다', () => {
    renderRecurringList()
    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getByText('추가')).toBeInTheDocument()
  })

  it('전체/지출/수입 필터 탭이 있다', () => {
    renderRecurringList()
    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('반복 거래 목록을 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('급여').length).toBeGreaterThan(0)
  })

  it('주기를 한국어로 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getAllByText('매월 25일').length).toBeGreaterThan(0)
    })
  })

  it('활성/정지 상태 뱃지를 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      const badges = screen.getAllByText('사용 중')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('추가 버튼이 있다', () => {
    renderRecurringList()
    expect(screen.getByText('추가')).toBeInTheDocument()
  })

  // ==================== 필터 전환 ====================

  it('지출 탭 클릭 시 지출만 표시한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/recurring', ({ request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type')
        if (type === 'expense') {
          return HttpResponse.json([mockItems[0]])
        }
        return HttpResponse.json(mockItems)
      }),
      http.get('/api/categories', () => HttpResponse.json([])),
    )
    renderRecurringList()
    await user.click(screen.getByText('지출'))
    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })
  })

  it('수입 탭 클릭 시 수입만 표시한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/recurring', ({ request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type')
        if (type === 'income') {
          return HttpResponse.json([mockItems[1]])
        }
        return HttpResponse.json(mockItems)
      }),
      http.get('/api/categories', () => HttpResponse.json([])),
    )
    renderRecurringList()
    await user.click(screen.getByText('수입'))
    await waitFor(() => {
      expect(screen.getAllByText('급여').length).toBeGreaterThan(0)
    })
  })

  // ==================== 빈/에러 상태 ====================

  it('빈 목록일 때 빈 상태를 표시한다', async () => {
    server.use(http.get('/api/recurring', () => HttpResponse.json([])))
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByText(/등록된 반복 거래가 없습니다/)).toBeInTheDocument()
    })
  })

  it('에러 발생 시 에러 상태를 표시한다', async () => {
    server.use(http.get('/api/recurring', () => HttpResponse.json({ detail: 'Error' }, { status: 500 })))
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
  })

  // ==================== 모달 ====================

  it('추가 버튼 클릭 시 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderRecurringList()
    await user.click(screen.getByText('추가'))
    expect(screen.getByText('반복 거래 추가')).toBeInTheDocument()
  })

  it('모달에서 닫기 클릭 시 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    renderRecurringList()
    await user.click(screen.getByText('추가'))
    expect(screen.getByText('반복 거래 추가')).toBeInTheDocument()

    await user.click(screen.getByLabelText('닫기'))
    expect(screen.queryByText('반복 거래 추가')).not.toBeInTheDocument()
  })

  // ==================== 바로 등록 (execute) ====================

  it('활성 항목에서 바로 등록 버튼을 클릭하면 실행된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.post('/api/recurring/1/execute', () =>
        HttpResponse.json({
          message: '넷플릭스 17,000원이 지출로 등록되었습니다',
          created_id: 100,
          type: 'expense',
          next_due_date: '2026-03-25',
        }, { status: 201 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const executeBtns = screen.getAllByTitle('바로 등록')
    await user.click(executeBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 실행했어요')
    })
  })

  // ==================== 활성화/비활성화 토글 ====================

  it('활성 항목에서 중지 버튼을 클릭하면 비활성화된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/1', () =>
        HttpResponse.json({ ...mockItems[0], is_active: false })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const pauseBtns = screen.getAllByTitle('중지')
    await user.click(pauseBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '상태를 변경했어요')
    })
  })

  it('비활성 항목에서 다시 시작 버튼을 클릭하면 활성화된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[2]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/3', () =>
        HttpResponse.json({ ...mockItems[2], is_active: true })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('정지된 거래').length).toBeGreaterThan(0)
    })

    const playBtns = screen.getAllByTitle('다시 시작')
    await user.click(playBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '상태를 변경했어요')
    })
  })

  // ==================== 삭제 ====================

  it('삭제 버튼 클릭 시 항목이 삭제된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.delete('/api/recurring/1', () => HttpResponse.json(null, { status: 204 })),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const deleteBtns = screen.getAllByTitle('삭제')
    await user.click(deleteBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 삭제했어요')
    })
  })

  it('삭제 확인을 취소하면 삭제되지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const deleteBtns = screen.getAllByTitle('삭제')
    await user.click(deleteBtns[0])

    // 삭제 토스트가 호출되지 않아야 함
    expect(mockAddToast).not.toHaveBeenCalledWith('success', '정기 거래를 삭제했어요')
  })

  // ==================== 수정 ====================

  it('수정 버튼 클릭 시 수정 모달이 열린다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const editBtns = screen.getAllByTitle('수정')
    await user.click(editBtns[0])

    expect(screen.getByText('반복 거래 수정')).toBeInTheDocument()
  })

  // ==================== 폼 제출 검증 ====================

  it('설명 없이 제출하면 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByText(/등록된 반복 거래가 없습니다/)).toBeInTheDocument()
    })

    // 빈 상태 화면의 추가 버튼으로 모달 열기
    await user.click(screen.getByText('반복 거래 추가'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // 금액만 입력하고 설명은 비워둠
    await user.type(screen.getByLabelText('금액'), '10000')
    await user.click(screen.getByText('추가하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '설명을 입력해주세요')
    })
  })

  it('금액 0으로 제출하면 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByText(/등록된 반복 거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('반복 거래 추가'))

    await user.type(screen.getByLabelText('설명'), '테스트')
    // 금액을 입력하지 않음 (기본 빈 문자열)
    await user.click(screen.getByText('추가하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '올바른 금액을 입력해주세요')
    })
  })

  // ==================== API 에러 ====================

  it('바로 등록 실패 시 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.post('/api/recurring/1/execute', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const executeBtns = screen.getAllByTitle('바로 등록')
    await user.click(executeBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '반복 거래 등록에 실패했어요')
    })
  })

  it('토글 실패 시 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/1', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const pauseBtns = screen.getAllByTitle('중지')
    await user.click(pauseBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '변경에 실패했어요')
    })
  })

  // ==================== 신규 추가 제출 성공 ====================

  it('신규 반복 거래를 성공적으로 추가한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.post('/api/recurring', () =>
        HttpResponse.json({
          id: 99, type: 'expense', amount: 10000, description: '테스트',
          frequency: 'monthly', day_of_month: 25, is_active: true,
          next_due_date: '2026-04-25',
        }, { status: 201 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByText(/등록된 반복 거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('반복 거래 추가'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(screen.getByLabelText('설명'), '테스트 반복')
    await user.type(screen.getByLabelText('금액'), '10000')
    await user.click(screen.getByText('추가하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 등록했어요')
    })
  })

  it('수정 모달에서 저장 시 수정 성공 메시지를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/1', () =>
        HttpResponse.json({ ...mockItems[0], description: '수정된 넷플릭스' })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const editBtns = screen.getAllByTitle('수정')
    await user.click(editBtns[0])

    expect(screen.getByText('반복 거래 수정')).toBeInTheDocument()

    // 수정 모달의 저장 버튼 클릭
    await user.click(screen.getByText('수정하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 수정했어요')
    })
  })

  it('삭제 실패 시 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.delete('/api/recurring/1', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })

    const deleteBtns = screen.getAllByTitle('삭제')
    await user.click(deleteBtns[0])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '삭제에 실패했어요')
    })
  })

  it('저장 실패 시 에러 토스트를 표시한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.post('/api/recurring', () =>
        HttpResponse.json({ detail: 'Error' }, { status: 500 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByText(/등록된 반복 거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('반복 거래 추가'))
    await user.type(screen.getByLabelText('설명'), '실패 테스트')
    await user.type(screen.getByLabelText('금액'), '10000')
    await user.click(screen.getByText('추가하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '저장에 실패했어요')
    })
  })
})
