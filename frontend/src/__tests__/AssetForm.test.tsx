/* 자산 등록 폼 검색 UX 테스트 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import AssetForm from '../pages/AssetForm'
import { assetApi } from '../api/assets'
import { accountApi } from '../api/accounts'
import { stockApi } from '../api/stocks'

vi.mock('../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({ activeHouseholdId: null }),
}))

vi.mock('../api/assets', () => ({
  assetApi: {
    search: vi.fn(),
    create: vi.fn(),
    parse: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createSnapshot: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../api/accounts', () => ({
  accountApi: {
    getAll: vi.fn(),
  },
}))

vi.mock('../api/stocks', () => ({
  stockApi: {
    search: vi.fn(),
  },
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

// 한국 주식 BE API 목 응답 데이터
const mockStocksKr = [
  { id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' },
  { id: 2, ticker: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { id: 3, ticker: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
]

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderAssetForm() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/assets/new']}>
        <Routes>
          <Route path="/assets/new" element={<AssetForm />} />
          <Route path="/assets" element={<div>자산 목록</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  ;(accountApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

  // 한국 주식 BE API 목 설정: 검색어에 따라 필터링
  ;(stockApi.search as ReturnType<typeof vi.fn>).mockImplementation((q: string) => {
    const results = mockStocksKr.filter(s => s.name.includes(q) || s.ticker.includes(q))
    return Promise.resolve({ data: results })
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AssetForm 검색 UX', () => {
  test('직접 입력 탭에서 한국주식 선택 시 검색 입력란이 표시된다', async () => {
    renderAssetForm()

    // 직접 입력 탭 클릭
    await userEvent.click(screen.getByText('직접 입력'))
    // 한국주식 선택
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    expect(screen.getByPlaceholderText('종목명 또는 코드 검색')).toBeInTheDocument()
  })

  test('한국 주식 검색 시 BE API에서 필터링된 결과가 표시된다', async () => {
    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '삼성')

    // BE API 디바운스 (300ms)
    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })
    // SK하이닉스는 "삼성" 검색에 매칭 안됨
    expect(screen.queryByText('SK하이닉스')).not.toBeInTheDocument()
  })

  test('한국 주식 검색에서 빈 결과 시 안내 메시지를 표시한다', async () => {
    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '없는종목')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument()
    })
  })

  test('API 에러 시 에러 메시지를 표시한다', async () => {
    ;(stockApi.search as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'))

    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '삼성')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('검색 중 오류가 발생했습니다')).toBeInTheDocument()
    })
  })

  test('빈 결과에서 직접 입력하기 버튼으로 수동 모드 전환', async () => {
    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '없는종목')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('직접 입력하기')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('직접 입력하기'))

    // 수동 모드에서는 종목명과 티커 입력란이 표시됨
    expect(screen.getByPlaceholderText('종목명 (예: 삼성전자)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('티커/코드 (선택, 예: 005930)')).toBeInTheDocument()
  })

  test('수동 모드에서 검색으로 돌아가기 클릭 시 검색 모드로 전환', async () => {
    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '없는종목')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('직접 입력하기')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('직접 입력하기'))
    expect(screen.getByPlaceholderText('종목명 (예: 삼성전자)')).toBeInTheDocument()

    // 검색으로 돌아가기
    await userEvent.click(screen.getByText('← 검색으로 돌아가기'))
    expect(screen.getByPlaceholderText('종목명 또는 코드 검색')).toBeInTheDocument()
  })

  test('검색 결과 클릭 시 종목이 선택된다', async () => {
    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_kr' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, '삼성')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })

    // 결과 클릭
    await userEvent.click(screen.getByText('삼성전자'))

    // 선택된 상태: 종목명과 티커가 표시되고 변경 버튼이 있음
    expect(screen.getByText('005930')).toBeInTheDocument()
    expect(screen.getByText('변경')).toBeInTheDocument()
  })

  test('미국 주식 검색은 백엔드 API를 사용한다', async () => {
    const mockResults = [
      { ticker: 'AAPL', name: 'Apple Inc.', market: 'US' },
    ]
    ;(assetApi.search as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockResults })

    renderAssetForm()
    await userEvent.click(screen.getByText('직접 입력'))
    fireEvent.change(screen.getByDisplayValue('예적금'), { target: { value: 'stock_us' } })

    const input = screen.getByPlaceholderText('종목명 또는 코드 검색')
    await userEvent.type(input, 'AAPL')

    act(() => { vi.advanceTimersByTime(350) })

    await waitFor(() => {
      expect(assetApi.search).toHaveBeenCalledWith('AAPL', 'us')
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    })
  })
})
