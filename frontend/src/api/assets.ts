/* 자산 관리 API */

import apiClient from './client'
import type { Asset, AssetSummary, AssetSnapshot, AssetSearchResult, AssetGoal, MonthlySavings, CreateAssetParams } from '../types'

export const assetApi = {
  getAll: (householdId: number) =>
    apiClient.get<Asset[]>('/assets', {
      params: { household_id: householdId },
    }),

  getById: (id: number) =>
    apiClient.get<Asset>(`/assets/${id}`),

  create: (data: CreateAssetParams) =>
    apiClient.post<Asset>('/assets', data),

  update: (id: number, data: Partial<CreateAssetParams>) =>
    apiClient.put<Asset>(`/assets/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/assets/${id}`),

  getSummary: (householdId: number) =>
    apiClient.get<AssetSummary>('/assets/summary', {
      params: { household_id: householdId },
    }),

  getSnapshots: (householdId: number, months?: number) =>
    apiClient.get<AssetSnapshot[]>('/assets/snapshots', {
      params: {
        household_id: householdId,
        ...(months && { months }),
      },
    }),

  search: (q: string, market?: string) =>
    apiClient.get<AssetSearchResult[]>('/assets/search', {
      params: { q, ...(market && { market }) },
    }),

  parse: (text: string) =>
    apiClient.post<{ items: CreateAssetParams[] }>('/assets/parse', { text }),

  /* 목표 관리 */
  getGoal: (householdId: number) =>
    apiClient.get<AssetGoal | null>('/assets/goal', {
      params: { household_id: householdId },
    }),

  setGoal: (data: { target_net_worth: number; target_date: string; household_id?: number }) =>
    apiClient.post<AssetGoal>('/assets/goal', data),

  deleteGoal: (householdId: number) =>
    apiClient.delete('/assets/goal', {
      params: { household_id: householdId },
    }),

  /* 월별 저축 추이 */
  getMonthlySavings: (householdId: number) =>
    apiClient.get<MonthlySavings>('/assets/monthly-savings', {
      params: { household_id: householdId },
    }),
}
