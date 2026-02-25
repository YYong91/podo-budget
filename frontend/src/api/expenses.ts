/* 지출 API */

import apiClient from './client'
import type { ChatResponse, Expense, MonthlyStats } from '../types'

interface GetExpensesParams {
  skip?: number
  limit?: number
  start_date?: string
  end_date?: string
  category_id?: number
  household_id?: number
  member_user_id?: number
}

export const expenseApi = {
  getAll: (params?: GetExpensesParams) =>
    apiClient.get<Expense[]>('/expenses', { params }),

  getById: (id: number) =>
    apiClient.get<Expense>(`/expenses/${id}`),

  create: (data: Partial<Expense>) =>
    apiClient.post<Expense>('/expenses', data),

  update: (id: number, data: Partial<Expense>) =>
    apiClient.put<Expense>(`/expenses/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/expenses/${id}`),

  getMonthlyStats: (month: string, householdId?: number) =>
    apiClient.get<MonthlyStats>('/expenses/stats/monthly', {
      params: { month, ...(householdId != null && { household_id: householdId }) },
    }),

  parseImage: (file: File, householdId?: number | null) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<ChatResponse>('/expenses/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: householdId != null ? { household_id: householdId } : undefined,
    })
  },
}
