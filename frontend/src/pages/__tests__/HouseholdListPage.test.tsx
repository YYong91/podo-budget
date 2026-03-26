/**
 * @file HouseholdListPage.test.tsx
 * @description 공유 가계부 목록 페이지 테스트
 * 가구 목록 표시, 빈 상태, 로딩 상태, 에러 상태를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import HouseholdListPage from '../HouseholdListPage'

// useNavigate 모킹
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

// useToast 모킹
const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// useHouseholdStore 모킹 변수
const mockFetchHouseholds = vi.fn()
const mockCreateHousehold = vi.fn()
const mockClearError = vi.fn()

let storeState: {
  households: Array<{
    id: number
    name: string
    description: string | null
    currency: string
    my_role: string
    member_count: number
    created_at: string
  }>
  isLoading: boolean
  error: string | null
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    ...storeState,
    fetchHouseholds: mockFetchHouseholds,
    createHousehold: mockCreateHousehold,
    clearError: mockClearError,
  }),
}))

function renderHouseholdList() {
  return render(
    <MemoryRouter>
      <HouseholdListPage />
    </MemoryRouter>
  )
}

const mockHouseholds = [
  {
    id: 1,
    name: '우리 가족',
    description: '가족 공유 가계부',
    currency: 'KRW',
    my_role: 'owner',
    member_count: 3,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '직장 동료',
    description: null,
    currency: 'KRW',
    my_role: 'member',
    member_count: 5,
    created_at: '2024-02-15T00:00:00Z',
  },
]

describe('HouseholdListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchHouseholds.mockResolvedValue(undefined)
    storeState = {
      households: [],
      isLoading: false,
      error: null,
    }
  })

  describe('로딩 상태', () => {
    it('로딩 중에는 스피너를 표시한다', () => {
      storeState = {
        households: [],
        isLoading: true,
        error: null,
      }

      renderHouseholdList()

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('빈 상태', () => {
    it('가구가 없으면 빈 상태 메시지를 표시한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('아직 속한 가구가 없습니다')).toBeInTheDocument()
      expect(screen.getByText('새로운 가구를 만들거나 다른 사람의 초대를 받아보세요')).toBeInTheDocument()
    })

    it('빈 상태에서 가구 만들기 버튼을 표시한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByRole('button', { name: '가구 만들기' })).toBeInTheDocument()
    })

    it('빈 상태에서 받은 초대 확인 버튼을 표시한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByRole('button', { name: '받은 초대 확인' })).toBeInTheDocument()
    })
  })

  describe('가구 목록 표시', () => {
    it('가구 설명 안내 문구를 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('가족이나 친구들과 함께 지출을 관리하세요')).toBeInTheDocument()
    })

    it('가구 목록을 카드 형태로 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('우리 가족')).toBeInTheDocument()
      expect(screen.getByText('직장 동료')).toBeInTheDocument()
    })

    it('가구 설명을 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('가족 공유 가계부')).toBeInTheDocument()
    })

    it('멤버 수를 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('3명')).toBeInTheDocument()
      expect(screen.getByText('5명')).toBeInTheDocument()
    })

    it('역할 배지를 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByText('소유자')).toBeInTheDocument()
      expect(screen.getByText('멤버')).toBeInTheDocument()
    })

    it('+ 가구 만들기 버튼을 표시한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(screen.getByRole('button', { name: '+ 가구 만들기' })).toBeInTheDocument()
    })
  })

  describe('가구 만들기 모달', () => {
    it('+ 가구 만들기 버튼 클릭 시 모달을 표시한다', async () => {
      const user = userEvent.setup()
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      await user.click(screen.getByRole('button', { name: '+ 가구 만들기' }))

      expect(screen.getByText('새 가구 만들기')).toBeInTheDocument()
    })
  })

  describe('에러 상태', () => {
    it('에러 발생 시 에러 상태를 표시한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: '네트워크 오류',
      }

      renderHouseholdList()

      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })

    it('에러 상태에서 다시 시도 버튼을 표시한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: '네트워크 오류',
      }

      renderHouseholdList()

      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    })
  })

  describe('마운트 시 데이터 조회', () => {
    it('컴포넌트 마운트 시 fetchHouseholds를 호출한다', () => {
      storeState = {
        households: [],
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      expect(mockFetchHouseholds).toHaveBeenCalled()
    })
  })

  describe('가구 카드 클릭', () => {
    it('가구 카드 클릭 시 상세 페이지로 이동한다', async () => {
      const user = userEvent.setup()
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      await user.click(screen.getByText('우리 가족'))

      expect(mockNavigate).toHaveBeenCalledWith('/households/1')
    })

    it('가구 카드에서 Enter 키 입력 시 상세 페이지로 이동한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      const card = screen.getByText('우리 가족').closest('[role="button"]')!
      card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      expect(mockNavigate).toHaveBeenCalledWith('/households/1')
    })
  })

  describe('가구 생성', () => {
    it('가구 생성 성공 시 상세 페이지로 이동한다', async () => {
      mockCreateHousehold.mockResolvedValueOnce({ id: 99, name: '새 가구' })
      const user = userEvent.setup()
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      await user.click(screen.getByRole('button', { name: '+ 가구 만들기' }))

      // 모달에서 가구 이름 입력
      const nameInput = screen.getByLabelText(/가구 이름/)
      await user.type(nameInput, '새 가구')

      // 만들기 버튼 클릭
      const createBtn = screen.getByRole('button', { name: '생성' })
      await user.click(createBtn)

      await waitFor(() => {
        expect(mockCreateHousehold).toHaveBeenCalled()
        expect(mockAddToast).toHaveBeenCalledWith('success', '가구가 생성되었습니다')
        expect(mockNavigate).toHaveBeenCalledWith('/households/99')
      })
    })

    it('가구 생성 실패 시 에러 토스트를 표시한다', async () => {
      mockCreateHousehold.mockRejectedValueOnce(new Error('생성 실패'))
      const user = userEvent.setup()
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: null,
      }

      renderHouseholdList()

      await user.click(screen.getByRole('button', { name: '+ 가구 만들기' }))

      const nameInput = screen.getByLabelText(/가구 이름/)
      await user.type(nameInput, '실패 가구')
      const createBtn = screen.getByRole('button', { name: '생성' })
      await user.click(createBtn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '가구 생성에 실패했습니다')
      })
    })
  })

  describe('에러 자동 토스트', () => {
    it('에러 발생 시 자동으로 토스트를 표시하고 clearError를 호출한다', () => {
      storeState = {
        households: mockHouseholds,
        isLoading: false,
        error: '서버 에러',
      }

      renderHouseholdList()

      expect(mockAddToast).toHaveBeenCalledWith('error', '처리에 실패했습니다')
      expect(mockClearError).toHaveBeenCalled()
    })
  })
})
