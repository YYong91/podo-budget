/* 자산 관리 API */

import apiClient from './client'
import type { Asset, AssetSummary, AssetSnapshot, AssetSearchResult, CreateAssetParams } from '../types'

export const assetApi = {
  getAll: (householdId?: number) =>
    apiClient.get<Asset[]>('/assets', {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),

  getById: (id: number) =>
    apiClient.get<Asset>(`/assets/${id}`),

  create: (data: CreateAssetParams) =>
    apiClient.post<Asset>('/assets', data),

  update: (id: number, data: Partial<CreateAssetParams>) =>
    apiClient.put<Asset>(`/assets/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/assets/${id}`),

  getSummary: (householdId?: number) =>
    apiClient.get<AssetSummary>('/assets/summary', {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),

  getSnapshots: (householdId?: number, months?: number) =>
    apiClient.get<AssetSnapshot[]>('/assets/snapshots', {
      params: {
        ...(householdId != null && { household_id: householdId }),
        ...(months && { months }),
      },
    }),

  search: (q: string, market?: string) =>
    apiClient.get<AssetSearchResult[]>('/assets/search', {
      params: { q, ...(market && { market }) },
    }),

  parse: (text: string) =>
    apiClient.post<{ items: CreateAssetParams[] }>('/assets/parse', { text }),
}
