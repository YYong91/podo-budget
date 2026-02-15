/* 인사이트 + 통계 API */

import apiClient from './client'
import type { InsightsResponse, StatsResponse, ComparisonResponse } from '../types'

export const insightsApi = {
  /** LLM 호출이 포함되므로 60초 타임아웃 적용 */
  generate: (month: string) =>
    apiClient.post<InsightsResponse>('/insights/generate', null, {
      params: { month },
      timeout: 60000,
    }),
}

export const statsApi = {
  /** 기간별 통계 조회 */
  getStats: (period: string, date?: string, householdId?: number) =>
    apiClient.get<StatsResponse>('/expenses/stats', {
      params: {
        period,
        ...(date && { date }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),

  /** 기간 비교 */
  getComparison: (period: string, date?: string, months?: number, householdId?: number) =>
    apiClient.get<ComparisonResponse>('/expenses/stats/comparison', {
      params: {
        period,
        ...(date && { date }),
        ...(months && { months }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),
}
