/* 결산 리포트 API 클라이언트 */

import apiClient from './client'
import type { MonthlyReportOrEligibility } from '../types/report'

export const reportsApi = {
  /**
   * 특정 월의 결산 리포트 조회
   * 리포트가 없으면 eligibility 포함한 응답 반환
   * @param month YYYY-MM 형식
   */
  getMonthly: (month: string, householdId?: number) => {
    const params: Record<string, unknown> = { month }
    if (householdId) params.household_id = householdId
    return apiClient.get<MonthlyReportOrEligibility>('/reports/monthly', { params })
  },

  /**
   * 가장 최근 완성된 결산 리포트 조회
   * 없으면 eligibility 포함한 응답 반환
   */
  getLatest: (householdId?: number) => {
    const params: Record<string, unknown> = {}
    if (householdId) params.household_id = householdId
    return apiClient.get<MonthlyReportOrEligibility>('/reports/latest', { params })
  },
}
