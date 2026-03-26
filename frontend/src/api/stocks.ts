/* 종목 검색 API — BE stocks 테이블 기반 */

import apiClient from './client'
import type { StockSearchResult } from '../types'

export const stockApi = {
  /** 종목명 또는 티커로 검색 (최대 20개) */
  search: (q: string) =>
    apiClient.get<StockSearchResult[]>('/stocks/search', { params: { q } }),
}
