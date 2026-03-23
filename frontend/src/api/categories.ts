/* 카테고리 API */

import apiClient from './client'
import type { Category } from '../types'

export const categoryApi = {
  getAll: (params?: { type?: 'expense' | 'income' }) =>
    apiClient.get<Category[]>('/categories', { params }),

  create: (data: { name: string; description?: string }) =>
    apiClient.post<Category>('/categories', data),

  update: (id: number, data: { name?: string; description?: string }) =>
    apiClient.put<Category>(`/categories/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/categories/${id}`),

  reorder: (categoryIds: number[]) =>
    apiClient.put<Category[]>('/categories/reorder', { category_ids: categoryIds }),
}
