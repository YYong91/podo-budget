/**
 * @file households.ts
 * @description 공유 가계부(Household) 관련 API 호출 함수
 * Household CRUD, 멤버 관리, 초대 관리 기능을 제공한다.
 */

import type {
  Household,
  HouseholdDetail,
  CreateHouseholdDto,
  UpdateHouseholdDto,
  InviteMemberDto,
  HouseholdInvitation,
  MemberRole,
  AcceptInvitationResponse,
} from '../types'
import apiClient from './client'

// ============================================================
// Household CRUD
// ============================================================

/**
 * 내가 속한 Household 목록 조회 API
 * @returns Household 목록
 */
export const getHouseholds = () =>
  apiClient.get<Household[]>('/households/')

/**
 * Household 상세 정보 조회 API
 * @param id - Household ID
 * @returns Household 상세 정보 (멤버 목록 포함)
 */
export const getHouseholdDetail = (id: number) =>
  apiClient.get<HouseholdDetail>(`/households/${id}`)

/**
 * Household 생성 API
 * @param data - 생성할 Household 정보
 * @returns 생성된 Household 정보
 */
export const createHousehold = (data: CreateHouseholdDto) =>
  apiClient.post<Household>('/households/', data)

/**
 * Household 수정 API
 * @param id - Household ID
 * @param data - 수정할 Household 정보
 * @returns 수정된 Household 정보
 */
export const updateHousehold = (id: number, data: UpdateHouseholdDto) =>
  apiClient.put<Household>(`/households/${id}`, data)

/**
 * Household 삭제 API
 * @param id - Household ID
 */
export const deleteHousehold = (id: number) =>
  apiClient.delete(`/households/${id}`)

// ============================================================
// 멤버 관리
// ============================================================

/**
 * 멤버 역할 변경 API
 * @param householdId - Household ID
 * @param userId - 대상 사용자 ID
 * @param role - 변경할 역할
 */
export const updateMemberRole = (householdId: number, userId: number, role: MemberRole) =>
  apiClient.put(`/households/${householdId}/members/${userId}/role`, { role })

/**
 * 멤버 추방 API (관리자/소유자가 다른 멤버를 추방)
 * @param householdId - Household ID
 * @param userId - 추방할 사용자 ID
 */
export const removeMember = (householdId: number, userId: number) =>
  apiClient.delete(`/households/${householdId}/members/${userId}`)

/**
 * Household 탈퇴 API (본인이 탈퇴)
 * @param householdId - Household ID
 */
export const leaveHousehold = (householdId: number) =>
  apiClient.post(`/households/${householdId}/leave`)

// ============================================================
// 초대 관리
// ============================================================

/**
 * Household의 초대 목록 조회 API
 * @param householdId - Household ID
 * @returns 초대 목록
 */
export const getHouseholdInvitations = (householdId: number) =>
  apiClient.get<HouseholdInvitation[]>(`/households/${householdId}/invitations`)

/**
 * 멤버 초대 생성 API
 * @param householdId - Household ID
 * @param data - 초대할 멤버 정보
 * @returns 생성된 초대 정보
 */
export const createInvitation = (householdId: number, data: InviteMemberDto) =>
  apiClient.post<HouseholdInvitation>(`/households/${householdId}/invitations`, data)

/**
 * 초대 취소 API
 * @param householdId - Household ID
 * @param invitationId - 초대 ID
 */
export const cancelInvitation = (householdId: number, invitationId: number) =>
  apiClient.delete(`/households/${householdId}/invitations/${invitationId}`)

// ============================================================
// 내가 받은 초대
// ============================================================

/**
 * 내가 받은 초대 목록 조회 API
 * @returns 내가 받은 초대 목록
 */
export const getMyInvitations = () =>
  apiClient.get<HouseholdInvitation[]>('/invitations/')

/**
 * 초대 수락 API
 * @param token - 초대 토큰
 * @returns 수락한 Household 정보
 */
export const acceptInvitation = (token: string) =>
  apiClient.post<AcceptInvitationResponse>(`/invitations/${token}/accept`)

/**
 * 초대 거절 API
 * @param token - 초대 토큰
 */
export const rejectInvitation = (token: string) =>
  apiClient.post(`/invitations/${token}/reject`)

// ============================================================
// 기본 export
// ============================================================

const householdApi = {
  getHouseholds,
  getHouseholdDetail,
  createHousehold,
  updateHousehold,
  deleteHousehold,
  updateMemberRole,
  removeMember,
  leaveHousehold,
  getHouseholdInvitations,
  createInvitation,
  cancelInvitation,
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
}

export default householdApi
