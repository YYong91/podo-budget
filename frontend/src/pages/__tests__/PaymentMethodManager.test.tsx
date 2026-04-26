/**
 * @file PaymentMethodManager.test.tsx
 * @description 결제수단 관리 페이지 테스트 (#305, #477)
 * 주 결제수단 드롭다운, 편집 모드, 실적 넛지, 추가 폼 접힘 등을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import PaymentMethodManager from '../PaymentMethodManager'
import { mockPaymentMethods } from '../../mocks/fixtures'

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

    it('결제수단 추가 버튼을 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('결제수단 추가')).toBeInTheDocument()
      })
    })
  })

  describe('주 결제수단 드롭다운', () => {
    it('주 결제수단 드롭다운이 표시된다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByLabelText('주 결제수단')).toBeInTheDocument()
      })
    })

    it('현재 기본 결제수단이 드롭다운에 선택되어 있다', async () => {
      renderPage()
      await waitFor(() => {
        const dropdown = screen.getByLabelText('주 결제수단') as HTMLSelectElement
        // 삼성카드가 is_default=true이므로 선택되어 있어야 함
        expect(dropdown.value).toBe('1')
      })
    })

    it('주 결제수단 변경 시 토스트를 표시한다', async () => {
      const user = userEvent.setup()

      // 현재 기본 해제 + 새 기본 설정 응답
      server.use(
        http.put('/api/payment-methods/:id', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          const id = Number(request.url.split('/').pop())
          const method = mockPaymentMethods.find((m) => m.id === id)
          return HttpResponse.json({
            ...method,
            ...body,
            updated_at: new Date().toISOString(),
          })
        })
      )

      renderPage()
      await waitFor(() => {
        expect(screen.getByLabelText('주 결제수단')).toBeInTheDocument()
      })

      const dropdown = screen.getByLabelText('주 결제수단')
      // 국민카드(id=2)로 변경
      await user.selectOptions(dropdown, '2')

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          'success',
          expect.stringContaining('국민카드')
        )
      })
    })

    it('주 결제수단 "없음" 선택 시 해제 토스트를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.put('/api/payment-methods/:id', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          const id = Number(request.url.split('/').pop())
          const method = mockPaymentMethods.find((m) => m.id === id)
          return HttpResponse.json({
            ...method,
            ...body,
            updated_at: new Date().toISOString(),
          })
        })
      )

      renderPage()
      await waitFor(() => {
        expect(screen.getByLabelText('주 결제수단')).toBeInTheDocument()
      })

      const dropdown = screen.getByLabelText('주 결제수단')
      await user.selectOptions(dropdown, '')

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('info', '주 결제수단을 해제했어요')
      })
    })

    it('주 결제수단 설정 시 안내 텍스트가 표시된다', async () => {
      renderPage()
      await waitFor(() => {
        // 삼성카드가 기본이므로 안내 텍스트 표시
        expect(screen.getByText('입력 시 자동으로 이 결제수단이 선택돼요')).toBeInTheDocument()
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

      await waitFor(() => {
        expect(screen.getByText('결제수단 추가')).toBeInTheDocument()
      })

      await user.click(screen.getByText('결제수단 추가'))

      const nameInput = screen.getByPlaceholderText('결제수단 이름')
      expect(nameInput).toBeInTheDocument()

      await user.type(nameInput, '신한카드')
      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('추가'))
      })
    })

    it('추가 폼에서 이름만 필수이고 타입/목표는 접힘 상태이다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('결제수단 추가')).toBeInTheDocument()
      })

      await user.click(screen.getByText('결제수단 추가'))

      // 이름 필드는 보이고
      expect(screen.getByPlaceholderText('결제수단 이름')).toBeInTheDocument()

      // 유형/목표 필드는 접힘 (안 보임)
      expect(screen.queryByLabelText('유형')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('월 실적 목표')).not.toBeInTheDocument()

      // 상세 설정 클릭 시 펼침
      await user.click(screen.getByText('상세 설정'))

      expect(screen.getByLabelText('유형')).toBeInTheDocument()
      expect(screen.getByLabelText('월 실적 목표')).toBeInTheDocument()
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

    it('빈 상태에서 결제수단 추가 버튼 클릭 시 추가 폼이 열린다', async () => {
      const user = userEvent.setup()
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

      // EmptyState action 버튼은 여러 "결제수단 추가" 버튼 중 첫 번째 (EmptyState 내부)
      const addButtons = screen.getAllByRole('button', { name: '결제수단 추가' })
      expect(addButtons.length).toBeGreaterThanOrEqual(1)
      await user.click(addButtons[0])

      // 추가 폼이 열린다
      expect(screen.getByPlaceholderText('결제수단 이름')).toBeInTheDocument()
    })
  })
})
