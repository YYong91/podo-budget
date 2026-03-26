/**
 * @file paymentMethods.ts
 * @description 결제수단 API 클라이언트
 * CRUD + 월별 사용액 조회
 */

import apiClient from './client'
import type { PaymentMethod, PaymentMethodUsage } from '../types'

export const paymentMethodApi = {
  /** 결제수단 목록 조회 */
  getAll: (householdId: number) =>
    apiClient.get<PaymentMethod[]>('/payment-methods', {
      params: { household_id: householdId },
    }),

  /** 결제수단 생성 */
  create: (data: {
    name: string
    type: string
    monthly_target?: number | null
    is_default?: boolean
  }) => apiClient.post<PaymentMethod>('/payment-methods', data),

  /** 결제수단 수정 */
  update: (
    id: number,
    data: {
      name?: string
      type?: string
      monthly_target?: number | null
      is_default?: boolean
      is_active?: boolean
    }
  ) => apiClient.put<PaymentMethod>(`/payment-methods/${id}`, data),

  /** 결제수단 삭제 (soft delete) */
  delete: (id: number) => apiClient.delete(`/payment-methods/${id}`),

  /** 결제수단별 월 사용액 조회 */
  getMonthlyUsage: (month: string, householdId: number) =>
    apiClient.get<PaymentMethodUsage[]>('/payment-methods/stats/monthly', {
      params: { month, household_id: householdId },
    }),
}
