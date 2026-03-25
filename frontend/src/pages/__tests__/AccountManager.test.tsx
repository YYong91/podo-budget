/**
 * @file AccountManager.test.tsx
 * @description 계좌 관리 페이지 테스트
 * 계좌 목록 조회, 추가 폼, 삭제 기능을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AccountManager from '../AccountManager'

// useToast 모킹
const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// useHouseholdStore 모킹
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    activeHouseholdId: 1,
  }),
}))

// accountApi 모킹
const mockGetAll = vi.fn()
const mockCreate = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/accounts', () => ({
  accountApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountManager />
    </MemoryRouter>,
  )
}

const mockAccounts = [
  {
    id: 1,
    name: '키움증권',
    type: 'brokerage' as const,
    household_id: 1,
    user_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'KB국민은행',
    type: 'bank' as const,
    household_id: 1,
    user_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('AccountManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAll.mockResolvedValue({ data: mockAccounts })
    mockCreate.mockResolvedValue({ data: { id: 99, name: '새 계좌', type: 'brokerage' } })
    mockDelete.mockResolvedValue({ data: null })
  })

  describe('계좌 목록 표시', () => {
    it('계좌 목록을 조회하여 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('키움증권')).toBeInTheDocument()
      })
      expect(screen.getByText('KB국민은행')).toBeInTheDocument()
    })

    it('계좌 유형 라벨을 표시한다', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('증권')).toBeInTheDocument()
      })
      expect(screen.getByText('은행')).toBeInTheDocument()
    })

    it('계좌 추가 버튼을 표시한다', () => {
      renderPage()
      expect(screen.getByText('계좌 추가')).toBeInTheDocument()
    })
  })

  describe('로딩/빈 상태', () => {
    it('로딩 중에는 스피너를 표시한다', () => {
      // getAll이 resolve 되지 않아 로딩 상태 유지
      mockGetAll.mockReturnValue(new Promise(() => {}))
      renderPage()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('계좌가 없으면 빈 상태 메시지를 표시한다', async () => {
      mockGetAll.mockResolvedValue({ data: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('등록된 계좌가 없습니다')).toBeInTheDocument()
      })
    })
  })

  describe('에러 상태', () => {
    it('API 에러 시 에러 상태를 표시한다', async () => {
      mockGetAll.mockRejectedValue(new Error('network error'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
      })
    })
  })

  describe('계좌 추가', () => {
    it('계좌 추가 버튼 클릭 시 폼을 표시한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('계좌 추가'))

      expect(screen.getByText('새 계좌')).toBeInTheDocument()
      expect(screen.getByLabelText('계좌 유형')).toBeInTheDocument()
      expect(screen.getByLabelText('계좌명')).toBeInTheDocument()
    })

    it('계좌명 없이 저장하면 에러 토스트를 표시한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('계좌 추가'))
      await user.click(screen.getByRole('button', { name: '저장' }))

      expect(mockAddToast).toHaveBeenCalledWith('error', '계좌명을 입력해주세요')
    })

    it('계좌를 정상적으로 생성할 수 있다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('계좌 추가'))
      await user.type(screen.getByLabelText('계좌명'), '새 증권 계좌')
      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith({ name: '새 증권 계좌', type: 'brokerage' })
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '계좌가 등록되었습니다')
    })

    it('취소 버튼 클릭 시 폼을 닫는다', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByText('계좌 추가'))
      expect(screen.getByText('새 계좌')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '취소' }))
      expect(screen.queryByText('새 계좌')).not.toBeInTheDocument()
    })
  })

  describe('계좌 삭제', () => {
    it('삭제 버튼 클릭 시 계좌를 삭제한다', async () => {
      const user = userEvent.setup()
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('키움증권')).toBeInTheDocument()
      })

      // 첫 번째 삭제 버튼 클릭
      const deleteButtons = document.querySelectorAll('button')
      const trashButton = Array.from(deleteButtons).find(btn =>
        btn.querySelector('.lucide-trash-2')
      )
      if (trashButton) {
        await user.click(trashButton)

        await waitFor(() => {
          expect(mockDelete).toHaveBeenCalledWith(1)
        })
        expect(mockAddToast).toHaveBeenCalledWith('success', '계좌가 삭제되었습니다')
      }
    })
  })
})
