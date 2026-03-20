/**
 * @file useHouseholdStore.test.ts
 * @description useHouseholdStore Zustand 스토어 테스트
 * 기본 상태, setActiveHouseholdId, clearError 등 동기 동작과
 * fetchHouseholds, createHousehold, deleteHousehold API 연동을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHouseholdStore } from '../useHouseholdStore'
import * as householdApi from '../../api/households'

// households API 모킹 — 명명된 export이므로 * as 형태로 모킹
vi.mock('../../api/households', () => ({
  getHouseholds: vi.fn(),
  getHouseholdDetail: vi.fn(),
  createHousehold: vi.fn(),
  updateHousehold: vi.fn(),
  deleteHousehold: vi.fn(),
  getMyInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  getHouseholdInvitations: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  leaveHousehold: vi.fn(),
}))

const mockHousehold1 = {
  id: 1,
  name: '우리집 가계부',
  description: null,
  currency: 'KRW',
  my_role: 'owner' as const,
  member_count: 1,
  created_at: '2024-01-01T00:00:00Z',
}

const mockHousehold2 = {
  id: 2,
  name: '부부 가계부',
  description: null,
  currency: 'KRW',
  my_role: 'member' as const,
  member_count: 2,
  created_at: '2024-02-01T00:00:00Z',
}

describe('useHouseholdStore', () => {
  // 각 테스트 전에 스토어 상태를 초기화한다
  beforeEach(() => {
    vi.clearAllMocks()

    useHouseholdStore.setState({
      households: [],
      currentHousehold: null,
      myInvitations: [],
      householdInvitations: [],
      activeHouseholdId: null,
      isLoading: false,
      isMutating: false,
      error: null,
      hasInitialized: false,
      initError: null,
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

    it('null 설정 시 기존 값을 유지한다 (가구 필수)', () => {
      useHouseholdStore.getState().setActiveHouseholdId(1)
      useHouseholdStore.getState().setActiveHouseholdId(null)

      // null은 무시됨 — 가구 필수화로 인해 activeHouseholdId는 항상 유지
      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)
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

  describe('fetchHouseholds', () => {
    it('가구 목록을 불러와 스토어에 저장한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1, mockHousehold2],
      } as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      await useHouseholdStore.getState().fetchHouseholds()

      const state = useHouseholdStore.getState()
      expect(state.households).toHaveLength(2)
      expect(state.households[0].id).toBe(1)
      expect(state.hasInitialized).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('첫 번째 가구를 자동으로 activeHouseholdId로 설정한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1, mockHousehold2],
      } as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      await useHouseholdStore.getState().fetchHouseholds()

      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)
    })

    it('이미 activeHouseholdId가 설정된 경우 기존 가구를 유지한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1, mockHousehold2],
      } as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      useHouseholdStore.setState({ activeHouseholdId: 2 })
      await useHouseholdStore.getState().fetchHouseholds()

      expect(useHouseholdStore.getState().activeHouseholdId).toBe(2)
    })

    it('API 오류 시 hasInitialized=true로 설정하고 예외를 던진다', async () => {
      vi.mocked(householdApi.getHouseholds).mockRejectedValueOnce(new Error('네트워크 오류'))

      await expect(useHouseholdStore.getState().fetchHouseholds()).rejects.toThrow()

      const state = useHouseholdStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.hasInitialized).toBe(true)
    })
  })

  describe('createHousehold', () => {
    it('새 가구를 생성하고 목록에 추가한다', async () => {
      vi.mocked(householdApi.createHousehold).mockResolvedValueOnce({
        data: mockHousehold1,
      } as Awaited<ReturnType<typeof householdApi.createHousehold>>)

      const result = await useHouseholdStore.getState().createHousehold({ name: '우리집 가계부' })

      expect(result.id).toBe(1)
      expect(useHouseholdStore.getState().households).toHaveLength(1)
      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.createHousehold).mockRejectedValueOnce(new Error('생성 실패'))

      await expect(
        useHouseholdStore.getState().createHousehold({ name: '테스트' })
      ).rejects.toThrow()

      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })
  })

  describe('deleteHousehold', () => {
    it('가구를 삭제하고 목록에서 제거한다', async () => {
      vi.mocked(householdApi.deleteHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.deleteHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
        activeHouseholdId: 1,
      })

      await useHouseholdStore.getState().deleteHousehold(2)

      expect(useHouseholdStore.getState().households).toHaveLength(1)
      expect(useHouseholdStore.getState().households[0].id).toBe(1)
    })

    it('활성 가구를 삭제하면 다른 가구로 activeHouseholdId가 전환된다', async () => {
      vi.mocked(householdApi.deleteHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.deleteHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
        activeHouseholdId: 1,
      })

      await useHouseholdStore.getState().deleteHousehold(1)

      // 삭제된 가구가 아닌 다른 가구(id=2)로 전환
      expect(useHouseholdStore.getState().activeHouseholdId).toBe(2)
    })

    it('마지막 가구를 삭제하면 activeHouseholdId가 null이 된다', async () => {
      vi.mocked(householdApi.deleteHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.deleteHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1],
        activeHouseholdId: 1,
      })

      await useHouseholdStore.getState().deleteHousehold(1)

      expect(useHouseholdStore.getState().households).toHaveLength(0)
      expect(useHouseholdStore.getState().activeHouseholdId).toBeNull()
    })
  })
})
