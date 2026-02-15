/**
 * @file useHouseholdStore.test.ts
 * @description useHouseholdStore Zustand 스토어 테스트
 * 기본 상태, setActiveHouseholdId, clearError 등 동기 동작을 테스트한다.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useHouseholdStore } from '../useHouseholdStore'

describe('useHouseholdStore', () => {
  // 각 테스트 전에 스토어 상태를 초기화한다
  beforeEach(() => {
    useHouseholdStore.setState({
      households: [],
      currentHousehold: null,
      myInvitations: [],
      activeHouseholdId: null,
      isLoading: false,
      error: null,
    })
  })

  describe('초기 상태', () => {
    it('기본 상태값이 올바르다', () => {
      const state = useHouseholdStore.getState()

      expect(state.households).toEqual([])
      expect(state.currentHousehold).toBeNull()
      expect(state.myInvitations).toEqual([])
      expect(state.activeHouseholdId).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setActiveHouseholdId', () => {
    it('활성 가구 ID를 설정한다', () => {
      useHouseholdStore.getState().setActiveHouseholdId(1)

      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)
    })

    it('활성 가구 ID를 null로 초기화한다', () => {
      useHouseholdStore.getState().setActiveHouseholdId(1)
      useHouseholdStore.getState().setActiveHouseholdId(null)

      expect(useHouseholdStore.getState().activeHouseholdId).toBeNull()
    })

    it('다른 가구로 전환한다', () => {
      useHouseholdStore.getState().setActiveHouseholdId(1)
      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)

      useHouseholdStore.getState().setActiveHouseholdId(2)
      expect(useHouseholdStore.getState().activeHouseholdId).toBe(2)
    })
  })

  describe('getActiveHouseholdId', () => {
    it('현재 활성 가구 ID를 반환한다', () => {
      useHouseholdStore.getState().setActiveHouseholdId(5)

      const activeId = useHouseholdStore.getState().getActiveHouseholdId()
      expect(activeId).toBe(5)
    })

    it('설정되지 않으면 null을 반환한다', () => {
      const activeId = useHouseholdStore.getState().getActiveHouseholdId()
      expect(activeId).toBeNull()
    })
  })

  describe('clearError', () => {
    it('에러 메시지를 초기화한다', () => {
      useHouseholdStore.setState({ error: '테스트 에러' })
      expect(useHouseholdStore.getState().error).toBe('테스트 에러')

      useHouseholdStore.getState().clearError()
      expect(useHouseholdStore.getState().error).toBeNull()
    })
  })

  describe('clearCurrentHousehold', () => {
    it('현재 선택된 Household를 초기화한다', () => {
      useHouseholdStore.setState({
        currentHousehold: {
          id: 1,
          name: '테스트',
          description: null,
          currency: 'KRW',
          my_role: 'owner',
          member_count: 1,
          created_at: '2024-01-01',
          members: [],
        },
      })

      useHouseholdStore.getState().clearCurrentHousehold()
      expect(useHouseholdStore.getState().currentHousehold).toBeNull()
    })
  })
})
