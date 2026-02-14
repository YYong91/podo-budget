/* 인사이트 API */

import apiClient from './client'
import type { InsightsResponse } from '../types'

export const insightsApi = {
  /** LLM 호출이 포함되므로 60초 타임아웃 적용 */
  generate: (month: string) =>
    apiClient.post<InsightsResponse>('/insights/generate', null, {
      params: { month },
      timeout: 60000,
    }),
}
