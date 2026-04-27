/**
 * @file PaymentMethodManager.test.tsx
 * @description 결제수단 관리 페이지 테스트 (#305, #477)
 * 기본 결제수단 별 아이콘 설정, 편집 모드, 실적 넛지, 추가 폼 등을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import PaymentMethodManager from '../PaymentMethodManager'

let mockAddToast: ReturnType<typeof vi.fn>
const mockGoBack = vi.fn()

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

vi.mock('../../hooks/useGoBack', () => ({
  useGoBack: () => mockGoBack,
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <PaymentMethodManager />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockAddToast = vi.fn()
  mockGoBack.mockReset()
})

describe('PaymentMethodManager', () => {
  describe('뒤로가기', () => {
    it('뒤로가기 버튼 클릭 시 useGoBack을 호출한다', async () => {
      const user = userEvent.setup()
      renderPage()

      const backBtn = screen.getByRole('button', { name: '뒤로가기' })
      await user.click(backBtn)

      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('기본 렌더링', () => {
    it('결제수단 목록을 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        // 시스템 결제수단 (현금, 계좌이체) + 사용자 결제수단 (삼성카드, 국민카드)
        expect(screen.getByTestId('payment-method-100')).toBeInTheDocument()
      })
      expect(screen.getByTestId('payment-method-101')).toBeInTheDocument()
      expect(screen.getByTestId('payment-method-1')).toBeInTheDocument()
      expect(screen.getByTestId('payment-method-2')).toBeInTheDocument()
    })

    it('monthly_target이 있는 결제수단에 실적 프로그레스 바를 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('usage-bar-1')).toBeInTheDocument()
      })
    })

    it('헤더 우상단에 + 버튼을 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '결제수단 추가' })).toBeInTheDocument()
      })
    })

    it('편집 모드에서는 + 버튼이 숨겨진다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => expect(screen.getByText('편집')).toBeInTheDocument())
      await user.click(screen.getByText('편집'))
      await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: '결제수단 추가' })).not.toBeInTheDocument()
    })
  })

  describe('기본 결제수단 설정', () => {
    it('기본 결제수단에 "기본" 뱃지가 표시된다', async () => {
      renderPage()
      await waitFor(() => {
        // 삼성카드(id=1)가 is_default=true
        const item = screen.getByTestId('payment-method-1')
        expect(within(item).getByText('기본')).toBeInTheDocument()
      })
    })

    it('편집 모드에서 각 항목에 별 아이콘 버튼이 표시된다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() => expect(screen.getByText('편집')).toBeInTheDocument())
      await user.click(screen.getByText('편집'))
      await waitFor(() => {
        // 사용자 결제수단(삼성카드, 국민카드) 각각에 별 버튼
        const item1 = screen.getByTestId('payment-method-1')
        const item2 = screen.getByTestId('payment-method-2')
        expect(within(item1).getByRole('button', { name: /기본/ })).toBeInTheDocument()
        expect(within(item2).getByRole('button', { name: /기본/ })).toBeInTheDocument()
      })
    })

    it('편집 모드에서 별 클릭 시 기본 결제수단이 변경되고 토스트가 표시된다', async () => {
      const user = userEvent.setup()

      renderPage()
      await waitFor(() => expect(screen.getByText('편집')).toBeInTheDocument())
      await user.click(screen.getByText('편집'))
      await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument())

      // 국민카드(id=2, is_default=false)의 "기본으로 설정" 버튼 클릭
      const item = screen.getByTestId('payment-method-2')
      await user.click(within(item).getByRole('button', { name: '기본으로 설정' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          'success',
          expect.stringContaining('국민카드')
        )
      })
    })

    it('편집 모드에서 기본 결제수단의 별 클릭 시 해제된다', async () => {
      const user = userEvent.setup()

      renderPage()
      await waitFor(() => expect(screen.getByText('편집')).toBeInTheDocument())
      await user.click(screen.getByText('편집'))
      await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument())

      // 삼성카드(id=1, is_default=true)의 "기본 해제" 버튼 클릭
      const item = screen.getByTestId('payment-method-1')
      await user.click(within(item).getByRole('button', { name: '기본 해제' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('info', expect.any(String))
      })
    })
  })

  describe('편집 모드', () => {
    it('편집 버튼 클릭 시 편집 모드 진입한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('편집')).toBeInTheDocument()
      })

      await user.click(screen.getByText('편집'))

      // 편집 모드에서 순서 변경 + 편집 + 삭제 버튼이 표시
      await waitFor(() => {
        expect(screen.getByText('완료')).toBeInTheDocument()
      })
      expect(screen.getAllByRole('button', { name: '위로' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: '아래로' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: '편집' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: '삭제' }).length).toBeGreaterThan(0)
    })

    it('일반 모드에서 편집/삭제 버튼이 숨겨진다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-1')).toBeInTheDocument()
      })

      // 일반 모드에서는 편집/삭제/순서 버튼이 없어야 함
      expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '위로' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '아래로' })).not.toBeInTheDocument()
    })

    it('편집 모드에서 삭제 버튼 클릭 시 결제수단을 삭제한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('편집')).toBeInTheDocument()
      })

      await user.click(screen.getByText('편집'))

      await waitFor(() => {
        expect(screen.getByText('완료')).toBeInTheDocument()
      })

      const userItem = screen.getByTestId('payment-method-2')
      const deleteBtn = within(userItem).getByRole('button', { name: '삭제' })
      await user.click(deleteBtn)

      // 인라인 확인 행이 노출되면 확인 삭제 버튼 클릭
      await waitFor(() => {
        expect(within(userItem).getByText(/을 삭제할까요/i)).toBeInTheDocument()
      })

      const confirmRow = within(userItem).getByText(/을 삭제할까요/i).closest('div')!
      await user.click(within(confirmRow).getByRole('button', { name: '삭제' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('삭제'))
      })
    })
  })

  describe('실적 넛지', () => {
    it('실적까지 남은 금액 넛지를 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-1')).toBeInTheDocument()
      })

      // 삼성카드: target 300000, spent 220000, 남은 80000
      const nudge = screen.getByTestId('nudge-1')
      expect(nudge).toBeInTheDocument()
      expect(nudge.textContent).toContain('실적까지')
      expect(nudge.textContent).toContain('남음')
    })
  })

  describe('tabular-nums 스타일', () => {
    it('실적/목표 금액 span에 tabular-nums 클래스가 있다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('usage-bar-1')).toBeInTheDocument()
      })

      // usage-bar-1 안의 첫 번째 span: "22만원 / 30만원" 형태
      const usageBar = screen.getByTestId('usage-bar-1')
      const amountSpan = usageBar.querySelector('span')
      expect(amountSpan).not.toBeNull()
      expect(amountSpan!.className).toContain('tabular-nums')
    })

    it('잔여/달성 span에 tabular-nums 클래스가 있다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('usage-bar-1')).toBeInTheDocument()
      })

      // usage-bar-1 안의 두 번째 span: "잔여 N원" 또는 "실적 달성"
      const usageBar = screen.getByTestId('usage-bar-1')
      const spans = usageBar.querySelectorAll('span')
      expect(spans.length).toBeGreaterThanOrEqual(2)
      expect(spans[1].className).toContain('tabular-nums')
    })

    it('넛지 p 태그에 tabular-nums 클래스가 있다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('nudge-1')).toBeInTheDocument()
      })

      const nudge = screen.getByTestId('nudge-1')
      expect(nudge.className).toContain('tabular-nums')
    })
  })

  describe('결제수단 추가', () => {
    it('추가 폼을 열고 새 결제수단을 생성한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '결제수단 추가' })).toBeInTheDocument()
      )
      await user.click(screen.getByRole('button', { name: '결제수단 추가' }))

      const nameInput = screen.getByPlaceholderText('결제수단 이름')
      expect(nameInput).toBeInTheDocument()

      await user.type(nameInput, '신한카드')
      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('추가'))
      })
    })

    it('+ 버튼 클릭 시 이름/유형/월목표 3개 필드가 모두 표시된다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '결제수단 추가' })).toBeInTheDocument()
      )
      await user.click(screen.getByRole('button', { name: '결제수단 추가' }))

      // 3개 필드 즉시 표시 (접힘 없음)
      expect(screen.getByPlaceholderText('결제수단 이름')).toBeInTheDocument()
      expect(screen.getByLabelText('유형')).toBeInTheDocument()
      expect(screen.getByLabelText('월 실적 목표')).toBeInTheDocument()

      // '상세 설정' 토글 버튼 없음
      expect(screen.queryByText('상세 설정')).not.toBeInTheDocument()
    })

    it('폼이 열린 상태에서 + 버튼이 숨겨진다', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '결제수단 추가' })).toBeInTheDocument()
      )
      await user.click(screen.getByRole('button', { name: '결제수단 추가' }))
      expect(screen.queryByRole('button', { name: '결제수단 추가' })).not.toBeInTheDocument()
    })

    it('하단 dashed 추가 버튼이 없다', async () => {
      renderPage()
      await waitFor(() =>
        expect(screen.getByTestId('payment-method-1')).toBeInTheDocument()
      )
      // 아이콘 버튼이므로 텍스트 "결제수단 추가"는 0개여야 함
      expect(screen.queryAllByText('결제수단 추가')).toHaveLength(0)
    })
  })

  describe('로딩 스켈레톤', () => {
    it('로딩 중에 bg-warm-200 없이 Skeleton 컴포넌트 카드를 3개 렌더링한다', () => {
      // 응답을 영구 지연시켜 로딩 상태를 유지한다
      server.use(
        http.get('/api/payment-methods', async () => {
          await new Promise(() => {}) // 절대 resolve 안 함
          return HttpResponse.json([])
        })
      )

      const { container } = renderPage()

      // 로딩 중: 구 방식의 bg-warm-200 클래스가 없어야 한다
      expect(container.querySelector('.bg-warm-200')).toBeNull()

      // Skeleton 컴포넌트(bg-[var(--skeleton-base)])가 렌더링된다
      const skeletonElements = container.querySelectorAll('[class*="skeleton-base"]')
      expect(skeletonElements.length).toBeGreaterThan(0)

      // 로딩 스켈레톤 카드 래퍼 3개가 렌더링된다
      const skeletonCards = container.querySelectorAll('.space-y-3 > div')
      expect(skeletonCards.length).toBe(3)
    })
  })

  describe('빈 상태', () => {
    it('결제수단이 없으면 EmptyState 컴포넌트로 등록 안내를 표시한다', async () => {
      server.use(
        http.get('/api/payment-methods', () => {
          return HttpResponse.json([])
        }),
        http.get('/api/payment-methods/stats/monthly', () => {
          return HttpResponse.json([])
        })
      )

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('등록된 결제수단이 없습니다')).toBeInTheDocument()
      })
      expect(screen.getByText('결제수단을 추가하면 지출 입력 시 태깅할 수 있어요')).toBeInTheDocument()
    })

    it('빈 상태에서 EmptyState 추가 버튼 클릭 시 추가 폼이 열린다', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/payment-methods', () => HttpResponse.json([])),
        http.get('/api/payment-methods/stats/monthly', () => HttpResponse.json([]))
      )

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('등록된 결제수단이 없습니다')).toBeInTheDocument()
      })

      // EmptyState action 버튼은 "결제수단 추가" 텍스트, 헤더 버튼은 "추가" 텍스트 (aria-label로 구분)
      const textBtn = screen.getByText('결제수단 추가')
      await user.click(textBtn)

      expect(screen.getByPlaceholderText('결제수단 이름')).toBeInTheDocument()
    })
  })
})
