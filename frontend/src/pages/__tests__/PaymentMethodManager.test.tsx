/**
 * @file PaymentMethodManager.test.tsx
 * @description 결제수단 관리 페이지 테스트 (#305)
 * 목록 표시, 추가, 기본 설정, 삭제, 실적 프로그레스 바를 테스트한다.
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

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
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
})

describe('PaymentMethodManager', () => {
  describe('기본 렌더링', () => {
    it('결제수단 목록을 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByTestId('payment-method-1')).toBeInTheDocument()
      })
      expect(screen.getByTestId('payment-method-2')).toBeInTheDocument()
      expect(screen.getByTestId('payment-method-3')).toBeInTheDocument()
    })

    it('기본 결제수단에 기본 배지를 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('삼성카드')).toBeInTheDocument()
      })
      expect(screen.getByText('기본')).toBeInTheDocument()
    })

    it('결제수단 추가 버튼을 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })
    })

    it('monthly_target이 있는 결제수단에 실적 프로그레스 바를 표시한다', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('삼성카드')).toBeInTheDocument()
      })
      // 삼성카드의 프로그레스 바 (73.3%)
      expect(screen.getByTestId('usage-bar-1')).toBeInTheDocument()
    })
  })

  describe('결제수단 추가', () => {
    it('추가 폼을 열고 새 결제수단을 생성한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '추가' }))

      // 폼 필드 확인
      const nameInput = screen.getByPlaceholderText('결제수단 이름')
      expect(nameInput).toBeInTheDocument()

      await user.type(nameInput, '신한카드')
      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('추가'))
      })
    })
  })

  describe('기본 결제수단 설정', () => {
    it('기본 결제수단 설정 시 안내 토스트를 표시한다', async () => {
      const user = userEvent.setup()

      // 기본 설정 변경 시 is_default=true로 응답
      server.use(
        http.put(`/api/payment-methods/:id`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            ...mockPaymentMethods[1],
            ...body,
            is_default: true,
            updated_at: new Date().toISOString(),
          })
        })
      )

      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-2')).toBeInTheDocument()
      })

      // 현금 항목의 기본 설정 버튼 클릭
      const cashItem = screen.getByTestId('payment-method-2')
      const setDefaultBtn = within(cashItem).getByRole('button', { name: '기본으로 설정' })
      await user.click(setDefaultBtn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          'success',
          expect.stringContaining('현금')
        )
      })
    })
  })

  describe('결제수단 삭제', () => {
    it('삭제 버튼 클릭 시 결제수단을 삭제한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('payment-method-2')).toBeInTheDocument()
      })

      const cashItem = screen.getByTestId('payment-method-2')
      const deleteBtn = within(cashItem).getByRole('button', { name: '삭제' })
      await user.click(deleteBtn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('삭제'))
      })
    })
  })

  describe('빈 상태', () => {
    it('결제수단이 없으면 안내 메시지를 표시한다', async () => {
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
    })
  })
})
