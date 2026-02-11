/* 카테고리 API */

import apiClient from './client'
import type { Category } from '../types'

export const categoryApi = {
  getAll: () =>
    apiClient.get<Category[]>('/categories'),

  create: (data: { name: string; description?: string }) =>
    apiClient.post<Category>('/categories', data),

  update: (id: number, data: { name?: string; description?: string }) =>
    apiClient.put<Category>(`/categories/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/categories/${id}`),
}
