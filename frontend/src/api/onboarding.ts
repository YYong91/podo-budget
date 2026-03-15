/* 온보딩 API */

import apiClient from './client'

interface OnboardingStatus {
  has_household: boolean
  household_count: number
}

interface CreateHouseholdResponse {
  id: number
  name: string
}

export const onboardingApi = {
  getStatus: () =>
    apiClient.get<OnboardingStatus>('/onboarding/status'),

  createHousehold: (name?: string) =>
    apiClient.post<CreateHouseholdResponse>('/onboarding/create-household', { name }),
}
