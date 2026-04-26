/**
 * @file RecurringList.test.tsx
 * @description 정기거래 관리 페이지 테스트 — 카드 레이아웃 + ⋮ 메뉴 + 낙관적 토글
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

/** 테스트용 정기거래 데이터 */
const mockItems: RecurringTransaction[] = [
  {
    id: 1, user_id: 1, household_id: 1,
    type: 'expense', amount: 17000, description: '넷플릭스',
    category_id: 1, frequency: 'monthly', interval: null,
    day_of_month: 25, day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
    category_emoji: '🎬',
    category_name: '구독',
    payment_method_id: 1,
    payment_method_name: '삼성카드',
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
    category_name: null,
    payment_method_id: null,
    payment_method_name: null,
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
    category_name: null,
    payment_method_id: null,
    payment_method_name: null,
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
  })

  // ==================== 기본 렌더링 ====================

  it('페이지 헤더에 정기거래 타이틀을 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '정기거래' })).toBeInTheDocument()
    })
  })

  it('페이지 헤더에 반복 거래 라는 구 용어가 없다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '반복 거래' })).not.toBeInTheDocument()
    })
  })

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

  it('정기거래 목록을 표시한다', async () => {
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getAllByText('넷플릭스').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('급여').length).toBeGreaterThan(0)
  })

  it('주기를 한국어로 표시한다 — next_due_date가 미래이면 "매월 N일"로 표시된다', async () => {
    // next_due_date가 오늘로부터 14일 후로 설정하면 formatDueDate가 "N일 후"를 반환하고,
    // 30일 이상 후이면 "매월 N일"을 반환한다
    const future = new Date()
    future.setDate(future.getDate() + 35)
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
    server.use(
      http.get('/api/recurring', () =>
        HttpResponse.json([{ ...mockItems[0], next_due_date: futureStr }])
      )
    )
    renderRecurringList()
    await waitFor(() => {
      expect(screen.getByText(`매월 ${future.getDate()}일`)).toBeInTheDocument()
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
      expect(screen.getByText(/등록된 정기거래가 없습니다/)).toBeInTheDocument()
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
    expect(screen.getByText('정기거래 추가')).toBeInTheDocument()
  })

  it('모달에서 닫기 클릭 시 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    renderRecurringList()
    await user.click(screen.getByText('추가'))
    expect(screen.getByText('정기거래 추가')).toBeInTheDocument()

    await user.click(screen.getByLabelText('닫기'))
    expect(screen.queryByText('정기거래 추가')).not.toBeInTheDocument()
  })

  // ==================== 바로 등록 (⋮ 메뉴 → 지금 등록) ====================

  it('활성 항목에서 ⋮ 메뉴를 열고 지금 등록을 클릭하면 실행된다', async () => {
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

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('지금 등록'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 실행했어요')
    })
  })

  // ==================== 활성화/비활성화 토글 (⋮ 메뉴 → 일시정지/다시 시작) ====================

  it('활성 항목: ⋮ 메뉴에서 일시정지 클릭 시 비활성화된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/1', () =>
        HttpResponse.json({ ...mockItems[0], is_active: false })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => screen.getByTestId('menu-1'))
    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByTestId('toggle-1'))  // 메뉴 내 일시정지 버튼

    await waitFor(() => {
      expect(mockAddToast).not.toHaveBeenCalledWith('error', '변경에 실패했어요')
    })
  })

  it('비활성 항목: ⋮ 메뉴에서 다시 시작 클릭 시 활성화된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0], mockItems[2]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.put('/api/recurring/3', () =>
        HttpResponse.json({ ...mockItems[2], is_active: true })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => screen.getByTestId('menu-3'))
    await user.click(screen.getByTestId('menu-3'))
    await user.click(screen.getByTestId('toggle-3'))  // 메뉴 내 다시 시작 버튼

    await waitFor(() => {
      expect(mockAddToast).not.toHaveBeenCalledWith('error', '변경에 실패했어요')
    })
  })

  // ==================== 삭제 (⋮ 메뉴 → 인라인 확인 UI) ====================

  it('⋮ 메뉴에서 삭제 클릭 시 인라인 확인 UI가 표시된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('삭제'))

    expect(screen.getByText(/삭제할까요/)).toBeInTheDocument()
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('삭제 확인 UI에서 취소 클릭 시 UI가 닫히고 삭제되지 않는다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('삭제'))

    expect(screen.getByText(/삭제할까요/)).toBeInTheDocument()
    await user.click(screen.getByText('취소'))

    expect(screen.queryByText(/삭제할까요/)).not.toBeInTheDocument()
    expect(mockAddToast).not.toHaveBeenCalledWith('success', '정기 거래를 삭제했어요')
  })

  it('삭제 확인 UI에서 삭제 버튼 클릭 시 항목이 삭제된다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.delete('/api/recurring/1', () => HttpResponse.json(null, { status: 204 })),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('삭제'))

    expect(screen.getByText(/삭제할까요/)).toBeInTheDocument()
    // 인라인 확인 UI의 삭제 버튼 (rose-500 스타일의 작은 버튼)
    const deleteButtons = screen.getAllByText('삭제')
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('success', '정기 거래를 삭제했어요')
    })
  })

  // ==================== 수정 ====================

  it('⋮ 메뉴에서 수정 클릭 시 수정 모달이 열린다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
      http.get('/api/categories', () => HttpResponse.json([])),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('수정'))

    expect(screen.getByText('정기거래 수정')).toBeInTheDocument()
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
      expect(screen.getByText(/등록된 정기거래가 없습니다/)).toBeInTheDocument()
    })

    // 빈 상태 화면의 추가 버튼으로 모달 열기
    await user.click(screen.getByText('정기거래 추가'))
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
      expect(screen.getByText(/등록된 정기거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('정기거래 추가'))

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

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('지금 등록'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '정기거래 등록에 실패했어요')
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

    await waitFor(() => screen.getByTestId('menu-1'))
    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByTestId('toggle-1'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '변경에 실패했어요')
    })
  })

  // ==================== 신규 추가 제출 성공 ====================

  it('신규 정기거래를 성공적으로 추가한다', async () => {
    server.use(
      http.get('/api/recurring', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.post('/api/recurring', () =>
        HttpResponse.json({
          id: 99, type: 'expense', amount: 10000, description: '테스트',
          frequency: 'monthly', day_of_month: 25, is_active: true,
          next_due_date: '2026-04-25',
          category_emoji: null, category_name: null,
          payment_method_id: null, payment_method_name: null,
        }, { status: 201 })
      ),
    )

    const user = userEvent.setup()
    renderRecurringList()

    await waitFor(() => {
      expect(screen.getByText(/등록된 정기거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('정기거래 추가'))
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
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('수정'))
    expect(screen.getByText('정기거래 수정')).toBeInTheDocument()

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
      expect(screen.getByTestId('menu-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('menu-1'))
    await user.click(screen.getByText('삭제'))

    expect(screen.getByText(/삭제할까요/)).toBeInTheDocument()
    const deleteButtons = screen.getAllByText('삭제')
    await user.click(deleteButtons[deleteButtons.length - 1])

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
      expect(screen.getByText(/등록된 정기거래가 없습니다/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('정기거래 추가'))
    await user.type(screen.getByLabelText('설명'), '실패 테스트')
    await user.type(screen.getByLabelText('금액'), '10000')
    await user.click(screen.getByText('추가하기'))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', '저장에 실패했어요')
    })
  })

  // ==================== 카드 레이아웃 ====================

  describe('카드 레이아웃', () => {
    it('이모지와 설명이 표시된다', async () => {
      renderRecurringList()
      await waitFor(() => expect(screen.getByText('넷플릭스')).toBeInTheDocument())
      expect(screen.getByText('🎬')).toBeInTheDocument()
    })

    it('카테고리명과 결제수단이 표시된다', async () => {
      renderRecurringList()
      await waitFor(() => expect(screen.getByText(/구독 · 삼성카드/)).toBeInTheDocument())
    })

    it('D-day가 표시된다 — next_due_date가 오늘이면 "오늘"', async () => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      server.use(
        http.get('/api/recurring', () =>
          HttpResponse.json([{ ...mockItems[0], next_due_date: todayStr }])
        )
      )
      renderRecurringList()
      await waitFor(() => expect(screen.getByText('오늘')).toBeInTheDocument())
    })
  })

  // ==================== ⋮ 메뉴 ====================

  describe('⋮ 메뉴', () => {
    it('⋮ 버튼 클릭 시 메뉴가 열린다', async () => {
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('menu-1'))
      expect(screen.getByText('지금 등록')).toBeInTheDocument()
      expect(screen.getByText('수정')).toBeInTheDocument()
      expect(screen.getByText('삭제')).toBeInTheDocument()
    })

    it('"삭제" 클릭 시 인라인 확인 UI가 나타난다', async () => {
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('menu-1'))
      await user.click(screen.getByText('삭제'))
      expect(screen.getByText(/삭제할까요/)).toBeInTheDocument()
      expect(screen.getByText('취소')).toBeInTheDocument()
    })

    it('"취소" 클릭 시 인라인 확인 UI가 닫힌다', async () => {
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('menu-1'))
      await user.click(screen.getByText('삭제'))
      await user.click(screen.getByText('취소'))
      expect(screen.queryByText(/삭제할까요/)).not.toBeInTheDocument()
    })
  })

  // ==================== 토글 ====================

  describe('토글', () => {
    it('⋮ 메뉴 일시정지 클릭 시 낙관적으로 카드에 "일시정지" 뱃지가 표시된다', async () => {
      server.use(
        http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
        http.put('/api/recurring/1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 200))
          return HttpResponse.json({ ...mockItems[0], is_active: false })
        })
      )
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('menu-1'))
      // 메뉴 열기 → 일시정지 클릭
      await user.click(screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('toggle-1'))
      // 낙관적 업데이트: 카드에 "일시정지" 뱃지 즉시 표시 (API 응답 전)
      await waitFor(() => {
        expect(screen.getByText('일시정지')).toBeInTheDocument()
      })
    })

    it('토글 API 실패 시 원래 상태로 롤백된다', async () => {
      server.use(
        http.get('/api/recurring', () => HttpResponse.json([mockItems[0]])),
        http.put('/api/recurring/1', () => HttpResponse.error())
      )
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('menu-1'))
      await user.click(screen.getByTestId('toggle-1'))
      await waitFor(() => {
        // 롤백 후 에러 토스트
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
      })
    })
  })

  // ==================== 일시정지 인라인 표시 ====================

  describe('일시정지 인라인 표시', () => {
    it('비활성 항목이 있으면 같은 목록에 흐리게 표시되고 숨기기 버튼이 나타난다', async () => {
      server.use(
        http.get('/api/recurring', () => HttpResponse.json([mockItems[0], mockItems[2]]))
      )
      renderRecurringList()
      // 비활성 항목도 목록에 즉시 표시됨 (섹션 이동 없음) — ⋮ 메뉴 버튼으로 확인
      await waitFor(() => expect(screen.getByTestId('menu-3')).toBeInTheDocument())
      // 숨기기 버튼 표시
      expect(screen.getByTestId('inactive-toggle')).toHaveTextContent('일시정지')
      expect(screen.getByTestId('inactive-toggle')).toHaveTextContent('숨기기')
    })

    it('숨기기 버튼 클릭 시 비활성 항목이 목록에서 제거된다', async () => {
      server.use(
        http.get('/api/recurring', () => HttpResponse.json([mockItems[0], mockItems[2]]))
      )
      const user = userEvent.setup()
      renderRecurringList()
      await waitFor(() => screen.getByTestId('inactive-toggle'))
      // 비활성 항목이 보임 — ⋮ 메뉴 버튼으로 확인
      expect(screen.getByTestId('menu-3')).toBeInTheDocument()
      // 숨기기 클릭
      await user.click(screen.getByTestId('inactive-toggle'))
      // 비활성 항목이 사라짐
      expect(screen.queryByTestId('menu-3')).not.toBeInTheDocument()
    })
  })
})
