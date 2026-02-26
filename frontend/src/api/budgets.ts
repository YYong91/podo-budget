/**
 * @file budgets.ts
 * @description 예산 관련 API 호출 함수
 * 예산 CRUD 및 알림 조회 기능을 제공한다.
 */

import type { Budget, BudgetCreateRequest, BudgetUpdateRequest, BudgetAlert, CategoryBudgetOverview } from '../types'
import apiClient from './client'

/**
 * 예산 목록 조회 API
 * @returns 예산 목록
 */
export const getBudgets = () =>
  apiClient.get<Budget[]>('/budgets/')

/**
 * 예산 생성 API
 * @param data - 생성할 예산 정보
 * @returns 생성된 예산 정보
 */
export const createBudget = (data: BudgetCreateRequest) =>
  apiClient.post<Budget>('/budgets/', data)

/**
 * 예산 수정 API
 * @param id - 예산 ID
 * @param data - 수정할 예산 정보
 * @returns 수정된 예산 정보
 */
export const updateBudget = (id: number, data: BudgetUpdateRequest) =>
  apiClient.put<Budget>(`/budgets/${id}`, data)

/**
 * 예산 삭제 API
 * @param id - 예산 ID
 */
export const deleteBudget = (id: number) =>
  apiClient.delete(`/budgets/${id}`)

/**
 * 예산 알림 조회 API
 * @returns 예산 초과/경고 알림 목록
 */
export const getBudgetAlerts = () =>
  apiClient.get<BudgetAlert[]>('/budgets/alerts')

/**
 * 카테고리별 예산 개요 조회 API
 * 전체 카테고리 + 최근 3개월 지출 + 현재 예산 정보를 반환한다
 * @returns 카테고리별 예산 개요 목록
 */
export const getCategoryOverview = () =>
  apiClient.get<CategoryBudgetOverview[]>('/budgets/category-overview')

const budgetApi = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetAlerts,
  getCategoryOverview,
}

export default budgetApi
