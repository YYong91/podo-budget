/**
 * @file useTickerSearch.ts
 * @description 종목 검색 커스텀 훅
 * 한국주식(로컬 JSON), 미국주식/코인(API) 검색을 디바운스 처리하며,
 * 드롭다운 외부 클릭 감지까지 포함한다.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { assetApi } from '../api/assets'
import type { AssetSearchResult } from '../types'

type Market = 'kr' | 'us' | 'crypto'
type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan'

// 한국 주식 정적 종목 리스트 (lazy load, 모듈 레벨 캐시)
let _stocksKrCache: AssetSearchResult[] | null = null
async function loadStocksKr(): Promise<AssetSearchResult[]> {
  if (_stocksKrCache) return _stocksKrCache
  const resp = await fetch('/stocks_kr.json')
  _stocksKrCache = await resp.json()
  return _stocksKrCache!
}

/** 테스트용 캐시 초기화 */
export function _resetStocksKrCache() { _stocksKrCache = null }

function searchStocksKrLocal(stocks: AssetSearchResult[], query: string): AssetSearchResult[] {
  const q = query.toLowerCase()
  const results: AssetSearchResult[] = []
  for (const s of stocks) {
    if (s.name.toLowerCase().includes(q) || s.ticker.includes(q)) {
      results.push(s)
      if (results.length >= 20) break
    }
  }
  return results
}

/** assetType에서 market을 추출. 투자형이 아니면 undefined */
function getMarket(assetType: AssetType): Market | undefined {
  if (assetType === 'stock_kr') return 'kr'
  if (assetType === 'stock_us') return 'us'
  if (assetType === 'crypto') return 'crypto'
  return undefined
}

/** 한국주식 디바운스 (ms) */
const KR_DEBOUNCE = 100
/** 미국주식/코인 디바운스 (ms) */
const API_DEBOUNCE = 300

export interface UseTickerSearchReturn {
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: AssetSearchResult[]
  showDropdown: boolean
  setShowDropdown: (v: boolean) => void
  searchLoading: boolean
  searchError: string | null
  manualMode: boolean
  setManualMode: (v: boolean) => void
  dropdownRef: React.RefObject<HTMLDivElement | null>
  /** 검색 상태 전체 초기화 (자산 타입 변경 시 호출) */
  resetSearch: () => void
}

export function useTickerSearch(assetType: AssetType): UseTickerSearchReturn {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 한국 주식 로컬 검색
  const searchKrLocal = useCallback(async (query: string) => {
    try {
      const stocks = await loadStocksKr()
      setSearchResults(searchStocksKrLocal(stocks, query))
      setShowDropdown(true)
      setSearchError(null)
    } catch {
      setSearchResults([])
      setShowDropdown(true)
      setSearchError('종목 데이터를 불러오지 못했습니다')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // 종목 검색 디바운스
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1 || manualMode) {
      setSearchResults([])
      setShowDropdown(false)
      setSearchLoading(false)
      setSearchError(null)
      return
    }
    const market = getMarket(assetType)
    if (!market) return

    if (searchTimer.current) clearTimeout(searchTimer.current)
    setSearchLoading(true)
    setSearchError(null)

    if (market === 'kr') {
      searchTimer.current = setTimeout(() => searchKrLocal(searchQuery), KR_DEBOUNCE)
    } else {
      searchTimer.current = setTimeout(() => {
        assetApi.search(searchQuery, market)
          .then(res => {
            setSearchResults(res.data)
            setShowDropdown(true)
            setSearchError(null)
          })
          .catch(() => {
            setSearchResults([])
            setShowDropdown(true)
            setSearchError('검색 중 오류가 발생했습니다')
          })
          .finally(() => setSearchLoading(false))
      }, API_DEBOUNCE)
    }
  }, [searchQuery, assetType, manualMode, searchKrLocal])

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const resetSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setManualMode(false)
    setShowDropdown(false)
    setSearchLoading(false)
    setSearchError(null)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    showDropdown,
    setShowDropdown,
    searchLoading,
    searchError,
    manualMode,
    setManualMode,
    dropdownRef,
    resetSearch,
  }
}
