/**
 * @file useTickerSearch.test.ts
 * @description useTickerSearch 훅 단위 테스트
 * 한국주식 BE API 검색, 미국주식/코인 API 검색, 디바운스, 외부 클릭, 리셋을 검증한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTickerSearch } from '../useTickerSearch'

// assetApi 모킹
const mockAssetSearch = vi.fn()
vi.mock('../../api/assets', () => ({
  assetApi: {
    search: (...args: unknown[]) => mockAssetSearch(...args),
  },
}))

// stockApi 모킹
const mockStockSearch = vi.fn()
vi.mock('../../api/stocks', () => ({
  stockApi: {
    search: (...args: unknown[]) => mockStockSearch(...args),
  },
}))

/** 디바운스 대기 (실제 타이머 기반) */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('useTickerSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('초기 상태', () => {
    it('기본값이 올바르다', () => {
      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchResults).toEqual([])
      expect(result.current.showDropdown).toBe(false)
      expect(result.current.searchLoading).toBe(false)
      expect(result.current.searchError).toBeNull()
      expect(result.current.manualMode).toBe(false)
    })
  })

  describe('한국주식 BE API 검색', () => {
    it('검색어 입력 시 BE API를 호출하여 결과를 반환한다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(mockStockSearch).toHaveBeenCalledWith('삼성')
        expect(result.current.searchResults).toHaveLength(1)
        expect(result.current.searchResults[0].name).toBe('삼성전자')
        expect(result.current.showDropdown).toBe(true)
        expect(result.current.searchLoading).toBe(false)
        expect(result.current.searchError).toBeNull()
      })
    })

    it('티커 코드로도 검색된다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('005930'))

      await waitFor(() => {
        expect(mockStockSearch).toHaveBeenCalledWith('005930')
        expect(result.current.searchResults).toHaveLength(1)
        expect(result.current.searchResults[0].ticker).toBe('005930')
      })
    })

    it('결과가 없으면 빈 배열을 반환한다', async () => {
      mockStockSearch.mockResolvedValue({ data: [] })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('존재하지않는종목'))

      await waitFor(() => {
        expect(result.current.searchResults).toEqual([])
        expect(result.current.showDropdown).toBe(true)
      })
    })

    it('API 에러 시 에러 상태를 설정한다', async () => {
      mockStockSearch.mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(result.current.searchError).toBe('검색 중 오류가 발생했습니다')
        expect(result.current.searchResults).toEqual([])
        expect(result.current.showDropdown).toBe(true)
      })
    })

    it('로컬 JSON 파일을 사용하지 않는다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(result.current.searchResults).toHaveLength(1)
      })

      // fetch('/stocks_kr.json')가 호출되지 않았는지 확인
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })

  describe('미국주식/코인 API 검색', () => {
    it('미국주식 검색 시 assetApi를 호출한다', async () => {
      mockAssetSearch.mockResolvedValue({
        data: [{ ticker: 'AAPL', name: 'Apple Inc.', market: 'US' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_us'))

      act(() => result.current.setSearchQuery('AAPL'))

      await waitFor(() => {
        expect(mockAssetSearch).toHaveBeenCalledWith('AAPL', 'us')
        expect(result.current.searchResults).toHaveLength(1)
        expect(result.current.searchResults[0].ticker).toBe('AAPL')
        expect(result.current.showDropdown).toBe(true)
      })
    })

    it('코인 검색 시 assetApi를 호출한다', async () => {
      mockAssetSearch.mockResolvedValue({
        data: [{ ticker: 'BTC', name: 'Bitcoin', market: 'crypto' }],
      })

      const { result } = renderHook(() => useTickerSearch('crypto'))

      act(() => result.current.setSearchQuery('BTC'))

      await waitFor(() => {
        expect(mockAssetSearch).toHaveBeenCalledWith('BTC', 'crypto')
        expect(result.current.searchResults).toHaveLength(1)
      })
    })

    it('API 에러 시 에러 상태를 설정한다', async () => {
      mockAssetSearch.mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useTickerSearch('stock_us'))

      act(() => result.current.setSearchQuery('FAIL'))

      await waitFor(() => {
        expect(result.current.searchError).toBe('검색 중 오류가 발생했습니다')
        expect(result.current.searchResults).toEqual([])
        expect(result.current.showDropdown).toBe(true)
      })
    })
  })

  describe('디바운스', () => {
    it('한국주식과 미국주식 모두 300ms 디바운스를 사용한다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })
      mockAssetSearch.mockResolvedValue({
        data: [{ ticker: 'AAPL', name: 'Apple', market: 'US' }],
      })

      const { result: krResult } = renderHook(() => useTickerSearch('stock_kr'))
      const { result: usResult } = renderHook(() => useTickerSearch('stock_us'))

      act(() => {
        krResult.current.setSearchQuery('삼성')
        usResult.current.setSearchQuery('AAPL')
      })

      // 150ms 후: 둘 다 아직 API 호출 안 됨 (300ms 디바운스)
      await delay(150)
      expect(mockStockSearch).not.toHaveBeenCalled()
      expect(mockAssetSearch).not.toHaveBeenCalled()

      // 350ms 후: 둘 다 검색 완료
      await waitFor(() => {
        expect(mockStockSearch).toHaveBeenCalled()
        expect(mockAssetSearch).toHaveBeenCalled()
      })
    })
  })

  describe('manualMode', () => {
    it('manualMode일 때 검색을 수행하지 않는다', async () => {
      const { result } = renderHook(() => useTickerSearch('stock_us'))

      act(() => {
        result.current.setManualMode(true)
        result.current.setSearchQuery('AAPL')
      })

      // 충분히 기다려도 검색 안 됨
      await delay(400)

      expect(mockAssetSearch).not.toHaveBeenCalled()
      expect(result.current.searchResults).toEqual([])
      expect(result.current.showDropdown).toBe(false)
    })
  })

  describe('비투자형 자산 타입', () => {
    it('deposit 타입에서는 검색을 수행하지 않는다', async () => {
      const { result } = renderHook(() => useTickerSearch('deposit'))

      act(() => result.current.setSearchQuery('anything'))

      await delay(400)

      expect(mockAssetSearch).not.toHaveBeenCalled()
      expect(mockStockSearch).not.toHaveBeenCalled()
      expect(result.current.searchResults).toEqual([])
    })
  })

  describe('외부 클릭 감지', () => {
    it('드롭다운이 열려 있을 때 외부 클릭 시 닫힌다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      // 검색하여 드롭다운 열기
      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(result.current.showDropdown).toBe(true)
      })

      // dropdownRef에 실제 DOM 요소 연결 (외부 클릭 감지를 위해)
      const dropdownEl = document.createElement('div')
      document.body.appendChild(dropdownEl)
      Object.defineProperty(result.current.dropdownRef, 'current', {
        value: dropdownEl,
        writable: true,
      })

      // 드롭다운 바깥 영역 클릭
      const outsideEl = document.createElement('div')
      document.body.appendChild(outsideEl)
      act(() => {
        outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      })

      expect(result.current.showDropdown).toBe(false)

      // 정리
      document.body.removeChild(dropdownEl)
      document.body.removeChild(outsideEl)
    })

    it('드롭다운 내부 클릭 시 닫히지 않는다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(result.current.showDropdown).toBe(true)
      })

      // dropdownRef에 실제 DOM 요소 연결
      const dropdownEl = document.createElement('div')
      const innerEl = document.createElement('button')
      dropdownEl.appendChild(innerEl)
      document.body.appendChild(dropdownEl)
      Object.defineProperty(result.current.dropdownRef, 'current', {
        value: dropdownEl,
        writable: true,
      })

      // 드롭다운 내부 클릭
      act(() => {
        innerEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      })

      expect(result.current.showDropdown).toBe(true)

      // 정리
      document.body.removeChild(dropdownEl)
    })
  })

  describe('resetSearch', () => {
    it('모든 검색 상태를 초기화한다', async () => {
      mockStockSearch.mockResolvedValue({
        data: [{ id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' }],
      })

      const { result } = renderHook(() => useTickerSearch('stock_kr'))

      // 검색 수행
      act(() => result.current.setSearchQuery('삼성'))

      await waitFor(() => {
        expect(result.current.searchResults.length).toBeGreaterThan(0)
      })

      // 리셋
      act(() => result.current.resetSearch())

      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchResults).toEqual([])
      expect(result.current.showDropdown).toBe(false)
      expect(result.current.searchLoading).toBe(false)
      expect(result.current.searchError).toBeNull()
      expect(result.current.manualMode).toBe(false)
    })
  })
})
