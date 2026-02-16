/* 정기 거래 API */

import apiClient from './client'
import type { RecurringTransaction, RecurringTransactionCreate, ExecuteResponse } from '../types'

export const recurringApi = {
  getAll: (params?: { type?: string; household_id?: number }) =>
    apiClient.get<RecurringTransaction[]>('/recurring', { params }),

  getPending: (householdId?: number) =>
    apiClient.get<RecurringTransaction[]>('/recurring/pending', {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),

  getById: (id: number) =>
    apiClient.get<RecurringTransaction>(`/recurring/${id}`),

  create: (data: RecurringTransactionCreate) =>
    apiClient.post<RecurringTransaction>('/recurring', data),

  update: (id: number, data: Partial<RecurringTransaction>) =>
    apiClient.put<RecurringTransaction>(`/recurring/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/recurring/${id}`),

  execute: (id: number) =>
    apiClient.post<ExecuteResponse>(`/recurring/${id}/execute`),

  skip: (id: number) =>
    apiClient.post<{ next_due_date: string }>(`/recurring/${id}/skip`),
}
