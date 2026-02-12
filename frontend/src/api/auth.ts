/**
 * @file auth.ts
 * @description 인증 관련 API 호출 함수
 * 로그인, 회원가입, 현재 사용자 정보 조회 기능을 제공한다.
 */

import type { LoginRequest, RegisterRequest, AuthResponse, User } from '../types'
import apiClient from './client'

/**
 * 회원가입 API
 * @param data - 사용자명과 비밀번호
 * @returns 생성된 사용자 정보
 */
export const register = (data: RegisterRequest) =>
  apiClient.post<User>('/auth/register', data)

/**
 * 로그인 API
 * @param data - 사용자명과 비밀번호
 * @returns 액세스 토큰 정보
 */
export const login = (data: LoginRequest) =>
  apiClient.post<AuthResponse>('/auth/login', data)

/**
 * 현재 로그인한 사용자 정보 조회 API
 * @returns 사용자 정보
 */
export const getCurrentUser = () =>
  apiClient.get<User>('/auth/me')

const authApi = {
  register,
  login,
  getCurrentUser,
}

export default authApi
