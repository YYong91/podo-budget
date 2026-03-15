/* 계좌 관리 API */

import apiClient from './client'
import type { Account, CreateAccountParams } from '../types'

export const accountApi = {
  getAll: (householdId: number) =>
    apiClient.get<Account[]>('/accounts', {
      params: { household_id: householdId },
    }),

  getById: (id: number) =>
    apiClient.get<Account>(`/accounts/${id}`),

  create: (data: CreateAccountParams) =>
    apiClient.post<Account>('/accounts', data),

  update: (id: number, data: Partial<CreateAccountParams>) =>
    apiClient.put<Account>(`/accounts/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/accounts/${id}`),
}
