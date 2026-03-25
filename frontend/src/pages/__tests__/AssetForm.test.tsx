/**
 * @file AssetForm.test.tsx
 * @description 자산 등록/수정 폼 페이지 테스트
 * 자연어 모드, 직접 입력 모드, 수정 모드를 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AssetForm, { _resetStocksKrCache } from '../AssetForm'

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

// useHouseholdStore 모킹
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    activeHouseholdId: 1,
  }),
}))

// assetApi 모킹
const mockAssetCreate = vi.fn()
const mockAssetUpdate = vi.fn()
const mockAssetDelete = vi.fn()
const mockAssetGetById = vi.fn()
const mockAssetParse = vi.fn()
const mockAssetSearch = vi.fn()

vi.mock('../../api/assets', () => ({
  assetApi: {
    create: (...args: unknown[]) => mockAssetCreate(...args),
    update: (...args: unknown[]) => mockAssetUpdate(...args),
    delete: (...args: unknown[]) => mockAssetDelete(...args),
    getById: (...args: unknown[]) => mockAssetGetById(...args),
    parse: (...args: unknown[]) => mockAssetParse(...args),
    search: (...args: unknown[]) => mockAssetSearch(...args),
  },
}))

// accountApi 모킹
const mockAccountGetAll = vi.fn()
vi.mock('../../api/accounts', () => ({
  accountApi: {
    getAll: (...args: unknown[]) => mockAccountGetAll(...args),
  },
}))

// analytics 모킹
vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}))

function renderNewAssetForm() {
  return render(
    <MemoryRouter initialEntries={['/assets/new']}>
      <Routes>
        <Route path="/assets/new" element={<AssetForm />} />
        <Route path="/assets" element={<div>자산 목록</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditAssetForm(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/assets/${id}/edit`]}>
      <Routes>
        <Route path="/assets/:id/edit" element={<AssetForm />} />
        <Route path="/assets" element={<div>자산 목록</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AssetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetStocksKrCache()
    mockAccountGetAll.mockResolvedValue({ data: [] })
    mockAssetCreate.mockResolvedValue({ data: { id: 99 } })
    mockAssetUpdate.mockResolvedValue({ data: { id: 1 } })
    mockAssetDelete.mockResolvedValue({ data: null })
  })

  describe('신규 모드', () => {
    it('모드 탭을 표시한다 (간편 입력 / 직접 입력)', () => {
      renderNewAssetForm()
      expect(screen.getByText('간편 입력')).toBeInTheDocument()
      expect(screen.getByText('직접 입력')).toBeInTheDocument()
    })

    it('기본적으로 간편 입력 모드를 표시한다', () => {
      renderNewAssetForm()
      expect(screen.getByText('보유 자산을 자유롭게 입력하면 자동으로 분석해드립니다.')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('보유 자산을 입력하세요...')).toBeInTheDocument()
    })

    it('분석하기 버튼이 비활성화 상태로 시작한다', () => {
      renderNewAssetForm()
      const analyzeBtn = screen.getByRole('button', { name: /분석하기/ })
      expect(analyzeBtn).toBeDisabled()
    })

    it('자연어 입력 후 분석하기 버튼이 활성화된다', async () => {
      const user = userEvent.setup()
      renderNewAssetForm()

      await user.type(screen.getByPlaceholderText('보유 자산을 입력하세요...'), '삼성전자 100주')

      const analyzeBtn = screen.getByRole('button', { name: /분석하기/ })
      expect(analyzeBtn).not.toBeDisabled()
    })

    it('자연어 분석 성공 시 프리뷰를 표시한다', async () => {
      const user = userEvent.setup()
      mockAssetParse.mockResolvedValue({
        data: {
          items: [{ name: '삼성전자', type: 'stock_kr', quantity: 100, avg_buy_price: 70000 }],
        },
      })

      renderNewAssetForm()

      await user.type(screen.getByPlaceholderText('보유 자산을 입력하세요...'), '삼성전자 100주 7만원')
      await user.click(screen.getByRole('button', { name: /분석하기/ }))

      await waitFor(() => {
        expect(screen.getByText(/분석 결과/)).toBeInTheDocument()
      })
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })

    it('직접 입력 모드로 전환할 수 있다', async () => {
      const user = userEvent.setup()
      renderNewAssetForm()

      await user.click(screen.getByText('직접 입력'))

      expect(screen.getByLabelText('자산 유형')).toBeInTheDocument()
      expect(screen.getByLabelText('자산명')).toBeInTheDocument()
    })

    it('직접 입력 모드에서 예적금 유형의 폼을 렌더링한다', async () => {
      const user = userEvent.setup()
      renderNewAssetForm()

      await user.click(screen.getByText('직접 입력'))

      // 기본 유형은 deposit (예적금)
      expect(screen.getByLabelText('자산명')).toBeInTheDocument()
      expect(screen.getByLabelText(/금액/)).toBeInTheDocument()
      expect(screen.getByLabelText(/이율/)).toBeInTheDocument()
      expect(screen.getByLabelText('만기일')).toBeInTheDocument()
    })

    it('자산명 필드가 필수 입력이다', async () => {
      const user = userEvent.setup()
      renderNewAssetForm()

      await user.click(screen.getByText('직접 입력'))

      // HTML5 required 속성으로 빈 자산명 제출 방지
      const nameInput = screen.getByLabelText('자산명')
      expect(nameInput).toBeRequired()

      // 빈 상태에서 제출 시 create가 호출되지 않음
      await user.click(screen.getByRole('button', { name: '저장하기' }))
      expect(mockAssetCreate).not.toHaveBeenCalled()
    })

    it('직접 입력 모드에서 자산을 생성할 수 있다', async () => {
      const user = userEvent.setup()
      renderNewAssetForm()

      await user.click(screen.getByText('직접 입력'))
      await user.type(screen.getByLabelText('자산명'), '비상금 통장')
      await user.click(screen.getByRole('button', { name: '저장하기' }))

      await waitFor(() => {
        expect(mockAssetCreate).toHaveBeenCalled()
      })
      expect(mockAddToast).toHaveBeenCalledWith('success', '자산이 등록되었습니다')
      expect(mockNavigate).toHaveBeenCalledWith('/assets')
    })

    it('뒤로가기 링크를 표시한다', () => {
      renderNewAssetForm()
      expect(screen.getByLabelText('뒤로가기')).toBeInTheDocument()
    })
  })

  describe('수정 모드', () => {
    beforeEach(() => {
      mockAssetGetById.mockResolvedValue({
        data: {
          id: 1,
          name: '비상금 통장',
          type: 'deposit',
          is_liability: false,
          ticker: null,
          quantity: null,
          avg_buy_price: null,
          manual_value: 5000000,
          interest_rate: 3.5,
          maturity_date: '2027-12-31',
          repayment_type: null,
          monthly_payment: null,
          account_id: null,
          memo: null,
        },
      })
    })

    it('기존 자산 데이터를 로드하여 폼에 표시한다', async () => {
      renderEditAssetForm(1)

      await waitFor(() => {
        expect(screen.getByDisplayValue('비상금 통장')).toBeInTheDocument()
      })
    })

    it('수정 모드에서 모드 탭을 표시하지 않는다', async () => {
      renderEditAssetForm(1)

      await waitFor(() => {
        expect(screen.getByDisplayValue('비상금 통장')).toBeInTheDocument()
      })

      expect(screen.queryByText('간편 입력')).not.toBeInTheDocument()
    })

    it('수정하기 버튼을 표시한다', async () => {
      renderEditAssetForm(1)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /수정하기/ })).toBeInTheDocument()
      })
    })

    it('자산 삭제 버튼을 표시한다', async () => {
      renderEditAssetForm(1)

      await waitFor(() => {
        expect(screen.getByText('자산 삭제')).toBeInTheDocument()
      })
    })

    it('삭제 버튼 클릭 시 확인 UI를 표시한다', async () => {
      const user = userEvent.setup()
      renderEditAssetForm(1)

      await waitFor(() => {
        expect(screen.getByText('자산 삭제')).toBeInTheDocument()
      })

      await user.click(screen.getByText('자산 삭제'))

      expect(screen.getByText('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')).toBeInTheDocument()
    })
  })
})
