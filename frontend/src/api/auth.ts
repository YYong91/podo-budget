/**
 * @file auth.ts
 * @description 인증 관련 API 호출 함수
 * podo-auth SSO 연동 후 로그인/회원가입은 auth.podonest.com에서 처리됩니다.
 * 현재 사용자 정보 조회만 제공합니다.
 */

import type { User } from '../types'
import apiClient from './client'

/**
 * 현재 로그인한 사용자 정보 조회 API
 * @returns 사용자 정보 (Shadow User - 로컬 Integer ID)
 */
export const getCurrentUser = () =>
  apiClient.get<User>('/auth/me')

const authApi = {
  getCurrentUser,
}

export default authApi
