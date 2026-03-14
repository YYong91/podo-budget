/* Admin 대시보드 API */

import apiClient from './client'
import type {
  OverviewStats,
  TransactionStats,
  HouseholdStats,
  FeedbackStats,
  AdminUserListResponse,
  AdminUserDetail,
} from '../types'

export const adminApi = {
  getOverviewStats: () =>
    apiClient.get<OverviewStats>('/admin/stats/overview'),

  getTransactionStats: (days = 30) =>
    apiClient.get<TransactionStats>('/admin/stats/transactions', { params: { days } }),

  getHouseholdStats: () =>
    apiClient.get<HouseholdStats>('/admin/stats/households'),

  getFeedbackStats: () =>
    apiClient.get<FeedbackStats>('/admin/stats/feedback'),

  getUserList: (page = 1, pageSize = 20, search?: string) =>
    apiClient.get<AdminUserListResponse>('/admin/users', {
      params: { page, page_size: pageSize, ...(search ? { search } : {}) },
    }),

  getUserDetail: (userId: number) =>
    apiClient.get<AdminUserDetail>(`/admin/users/${userId}`),

  updateUser: (userId: number, data: { is_active?: boolean }) =>
    apiClient.patch<AdminUserDetail>(`/admin/users/${userId}`, data),
}
