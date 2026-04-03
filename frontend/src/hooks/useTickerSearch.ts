/**
 * @file useTickerSearch.ts
 * @description 종목 검색 커스텀 훅
 * 한국주식(BE API), 미국주식/코인(assetApi) 검색을 디바운스 처리하며,
 * 드롭다운 외부 클릭 감지까지 포함한다.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { assetApi } from '../api/assets'
import { stockApi } from '../api/stocks'
import type { AssetSearchResult, AssetType } from '../types'

type Market = 'kr' | 'us' | 'crypto'

/** assetType에서 market을 추출. 투자형이 아니면 undefined */
function getMarket(assetType: AssetType): Market | undefined {
  if (assetType === 'stock_kr') return 'kr'
  if (assetType === 'stock_us') return 'us'
  if (assetType === 'crypto') return 'crypto'
  return undefined
}

/** 디바운스 시간 (ms) — 모든 종목 검색 공통 */
const DEBOUNCE_MS = 300

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

  // 한국 주식 BE API 검색
  const searchKrApi = useCallback(async (query: string) => {
    try {
      const res = await stockApi.search(query)
      // StockSearchResult → AssetSearchResult 변환 (id 필드 제거)
      const results: AssetSearchResult[] = res.data.map(s => ({
        ticker: s.ticker,
        name: s.name,
        market: s.market,
      }))
      setSearchResults(results)
      setShowDropdown(true)
      setSearchError(null)
    } catch {
      setSearchResults([])
      setShowDropdown(true)
      setSearchError('검색 중 오류가 발생했습니다')
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
      // 한국 주식: BE API 호출
      searchTimer.current = setTimeout(() => searchKrApi(searchQuery), DEBOUNCE_MS)
    } else {
      // 미국 주식/코인: 기존 assetApi 유지
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
      }, DEBOUNCE_MS)
    }
  }, [searchQuery, assetType, manualMode, searchKrApi])

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
