/**
 * @file household.ts
 * @description 공유 가계부(Household) 관련 타입 정의
 * Household CRUD, 멤버 관리, 초대 관리에 필요한 타입들을 정의한다.
 */

/**
 * Household 기본 정보
 */
export interface Household {
  id: number
  name: string
  description: string | null
  currency: string
  my_role: 'owner' | 'admin' | 'member'
  member_count: number
  created_at: string
}

/**
 * Household 상세 정보 (멤버 목록 포함)
 */
export interface HouseholdDetail extends Household {
  members: HouseholdMember[]
}

/**
 * Household 멤버 정보
 */
export interface HouseholdMember {
  user_id: number
  username: string
  email: string | null
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

/**
 * Household 초대 정보
 */
export interface HouseholdInvitation {
  id: number
  household_id: number
  household_name?: string
  invitee_email: string
  inviter_username?: string
  role: 'member' | 'admin'
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  token?: string
  expires_at: string
  created_at: string
}

/**
 * Household 생성 요청 DTO
 */
export interface CreateHouseholdDto {
  name: string
  description?: string
  currency?: string
}

/**
 * Household 수정 요청 DTO
 */
export interface UpdateHouseholdDto {
  name?: string
  description?: string
}

/**
 * 멤버 초대 요청 DTO
 */
export interface InviteMemberDto {
  email: string
  role?: 'member' | 'admin'
}

/**
 * 멤버 역할 타입
 */
export type MemberRole = 'owner' | 'admin' | 'member'

/**
 * 초대 수락 응답
 */
export interface AcceptInvitationResponse {
  household_id: number
  household_name: string
}
