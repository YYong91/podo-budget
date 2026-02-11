/* 인사이트 API */

import apiClient from './client'
import type { InsightsResponse } from '../types'

export const insightsApi = {
  generate: (month: string) =>
    apiClient.post<InsightsResponse>('/insights/generate', null, { params: { month } }),
}
