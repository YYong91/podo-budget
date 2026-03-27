/**
 * @file useHouseholdRole.ts
 * @description 가구 내 역할 기반 권한 판단 훅
 * HouseholdDetail의 my_role을 기반으로 isOwner, isAdmin, canManageMember를 반환한다.
 */

import type { HouseholdDetail, HouseholdMember } from '../types'

interface HouseholdRoleResult {
  /** 소유자인지 여부 */
  isOwner: boolean
  /** 관리자(owner 포함)인지 여부 */
  isAdmin: boolean
  /** 해당 멤버를 관리(역할 변경, 내보내기)할 수 있는지 여부 */
  canManageMember: (member: HouseholdMember, currentUserId: number) => boolean
}

/**
 * 가구 역할 기반 권한 판단 훅
 * @param household - 가구 상세 정보 (null이면 모든 권한 false)
 */
export function useHouseholdRole(household: HouseholdDetail | null): HouseholdRoleResult {
  const isOwner = household?.my_role === 'owner'
  const isAdmin = isOwner || household?.my_role === 'admin'

  const canManageMember = (member: HouseholdMember, currentUserId: number): boolean => {
    if (!isOwner) return false
    if (member.user_id === currentUserId) return false
    if (member.role === 'owner') return false
    return true
  }

  return { isOwner, isAdmin, canManageMember }
}
