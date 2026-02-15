/* 수입 API */

import apiClient from './client'
import type { Income, StatsResponse } from '../types'

interface GetIncomesParams {
  skip?: number
  limit?: number
  start_date?: string
  end_date?: string
  category_id?: number
  household_id?: number
  member_user_id?: number
}

export const incomeApi = {
  getAll: (params?: GetIncomesParams) =>
    apiClient.get<Income[]>('/income', { params }),

  getById: (id: number) =>
    apiClient.get<Income>(`/income/${id}`),

  create: (data: Partial<Income>) =>
    apiClient.post<Income>('/income', data),

  update: (id: number, data: Partial<Income>) =>
    apiClient.put<Income>(`/income/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/income/${id}`),

  getStats: (period: string, date?: string, householdId?: number) =>
    apiClient.get<StatsResponse>('/income/stats', {
      params: {
        period,
        ...(date && { date }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),
}
