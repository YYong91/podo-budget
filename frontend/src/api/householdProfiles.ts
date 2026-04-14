/**
 * @file householdProfiles.ts
 * @description HouseholdProfile 관련 API 호출 함수
 * 가구의 프로필 정보(재정 목표, 주택 유형, 소득원 등)를 관리한다.
 */

import type { AxiosError } from 'axios'

import type { HouseholdProfile, HouseholdProfileInput } from '../types'
import apiClient from './client'

// ============================================================
// snake_case ↔ camelCase 변환
// ============================================================

/**
 * 프론트 입력(camelCase)을 백엔드 포맷(snake_case)으로 변환
 */
function toSnakeCase(input: HouseholdProfileInput): Record<string, unknown> {
  return {
    household_type: input.householdType,
    housing_type: input.housingType,
    income_types: input.incomeTypes,
    age_range: input.ageRange,
    financial_goal: input.financialGoal ?? null,
    goal_amount: input.goalAmount ?? null,
    goal_deadline: input.goalDeadline ?? null,
    primary_concern: input.primaryConcern ?? null,
  }
}

/**
 * 백엔드 응답(snake_case)을 프론트 포맷(camelCase)으로 변환
 */
function toCamelCase(data: Record<string, unknown>): HouseholdProfile {
  return {
    id: data.id as number,
    householdId: data.household_id as number,
    householdType: data.household_type as HouseholdProfile['householdType'],
    housingType: data.housing_type as HouseholdProfile['housingType'],
    incomeTypes: data.income_types as HouseholdProfile['incomeTypes'],
    ageRange: data.age_range as HouseholdProfile['ageRange'],
    financialGoal: data.financial_goal as HouseholdProfile['financialGoal'],
    goalAmount: data.goal_amount as number | null,
    goalDeadline: data.goal_deadline as string | null,
    primaryConcern: data.primary_concern as HouseholdProfile['primaryConcern'],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

// ============================================================
// API 호출 함수
// ============================================================

/**
 * HouseholdProfile 조회 API
 * @param householdId - Household ID
 * @returns HouseholdProfile
 */
export const getHouseholdProfile = (householdId: number): Promise<HouseholdProfile | null> =>
  apiClient
    .get<Record<string, unknown>>(`/household-profiles/${householdId}`)
    .then((res) => toCamelCase(res.data))
    .catch((err: AxiosError) => {
      // 프로필 미생성 상태는 404가 정상 — 에러 토스트 없이 null 반환
      if (err.response?.status === 404) return null
      throw err
    })

/**
 * HouseholdProfile 생성 또는 업데이트 API
 * @param householdId - Household ID
 * @param input - 저장할 프로필 정보
 * @returns 저장된 HouseholdProfile
 */
export const upsertHouseholdProfile = (householdId: number, input: HouseholdProfileInput) =>
  apiClient
    .put<Record<string, unknown>>(
      `/household-profiles/${householdId}`,
      toSnakeCase(input),
    )
    .then((res) => toCamelCase(res.data))

// ============================================================
// 기본 export
// ============================================================

const householdProfilesApi = {
  getHouseholdProfile,
  upsertHouseholdProfile,
}

export default householdProfilesApi
