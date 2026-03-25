/**
 * @file useHouseholdRole.test.ts
 * @description useHouseholdRole 훅 테스트
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHouseholdRole } from '../useHouseholdRole'
import type { HouseholdDetail, HouseholdMember } from '../../types'

const makeMember = (overrides: Partial<HouseholdMember> = {}): HouseholdMember => ({
  user_id: 2,
  username: '김철수',
  email: 'kim@example.com',
  role: 'member',
  joined_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeHousehold = (role: 'owner' | 'admin' | 'member'): HouseholdDetail => ({
  id: 1,
  name: '테스트 가구',
  description: null,
  currency: 'KRW',
  my_role: role,
  member_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  members: [
    makeMember({ user_id: 1, username: '홍길동', role: 'owner' }),
    makeMember({ user_id: 2, username: '김철수', role: 'member' }),
  ],
})

describe('useHouseholdRole', () => {
  it('household가 null이면 모든 권한이 false이다', () => {
    const { result } = renderHook(() => useHouseholdRole(null))
    expect(result.current.isOwner).toBe(false)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.canManageMember(makeMember(), 1)).toBe(false)
  })

  it('owner는 isOwner=true, isAdmin=true', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('owner')))
    expect(result.current.isOwner).toBe(true)
    expect(result.current.isAdmin).toBe(true)
  })

  it('admin은 isOwner=false, isAdmin=true', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('admin')))
    expect(result.current.isOwner).toBe(false)
    expect(result.current.isAdmin).toBe(true)
  })

  it('member는 isOwner=false, isAdmin=false', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('member')))
    expect(result.current.isOwner).toBe(false)
    expect(result.current.isAdmin).toBe(false)
  })

  it('owner는 다른 멤버를 관리할 수 있다', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('owner')))
    const member = makeMember({ user_id: 2, role: 'member' })
    expect(result.current.canManageMember(member, 1)).toBe(true)
  })

  it('owner는 자기 자신을 관리할 수 없다', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('owner')))
    const member = makeMember({ user_id: 1, role: 'owner' })
    expect(result.current.canManageMember(member, 1)).toBe(false)
  })

  it('owner는 다른 owner를 관리할 수 없다', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('owner')))
    const member = makeMember({ user_id: 3, role: 'owner' })
    expect(result.current.canManageMember(member, 1)).toBe(false)
  })

  it('admin은 멤버를 관리할 수 없다 (owner만 가능)', () => {
    const { result } = renderHook(() => useHouseholdRole(makeHousehold('admin')))
    const member = makeMember({ user_id: 2, role: 'member' })
    expect(result.current.canManageMember(member, 1)).toBe(false)
  })
})
