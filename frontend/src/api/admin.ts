/* Admin 대시보드 API */

import apiClient from './client'
import type {
  DashboardStats,
  AdminUserListResponse,
  AdminUserDetail,
} from '../types'

export const adminApi = {
  getDashboardStats: () =>
    apiClient.get<DashboardStats>('/admin/stats/dashboard'),

  getUserList: (page = 1, pageSize = 20, search?: string) =>
    apiClient.get<AdminUserListResponse>('/admin/users', {
      params: { page, page_size: pageSize, ...(search ? { search } : {}) },
    }),

  getUserDetail: (userId: number) =>
    apiClient.get<AdminUserDetail>(`/admin/users/${userId}`),

  updateUser: (userId: number, data: { is_active?: boolean }) =>
    apiClient.patch<AdminUserDetail>(`/admin/users/${userId}`, data),
}
