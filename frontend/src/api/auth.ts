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

/**
 * 계정 삭제 API
 * @returns 삭제 성공 응답
 */
export const deleteAccount = () =>
  apiClient.delete('/auth/me')

/**
 * 비밀번호 찾기 API
 * @param email - 등록된 이메일 주소
 */
export const forgotPassword = (email: string) =>
  apiClient.post('/auth/forgot-password', { email })

/**
 * 비밀번호 재설정 API
 * @param token - 재설정 토큰
 * @param new_password - 새 비밀번호
 */
export const resetPassword = (token: string, new_password: string) =>
  apiClient.post('/auth/reset-password', { token, new_password })

const authApi = {
  register,
  login,
  getCurrentUser,
  deleteAccount,
  forgotPassword,
  resetPassword,
}

export default authApi
