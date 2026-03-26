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

const mockHouseholdDetail1 = {
  id: 1,
  name: '우리집 가계부',
  description: null,
  currency: 'KRW',
  my_role: 'owner' as const,
  member_count: 1,
  created_at: '2024-01-01T00:00:00Z',
  members: [{ user_id: 1, username: '테스트유저', email: 'test@example.com', role: 'owner' as const, joined_at: '2024-01-01T00:00:00Z' }],
}

const mockInvitation = {
  id: 100,
  household_id: 1,
  household_name: '우리집 가계부',
  email: 'test@example.com',
  role: 'member' as const,
  status: 'pending' as const,
  token: 'test-token',
  invited_by: 1,
  invited_by_nickname: '테스트유저',
  created_at: '2024-03-01T00:00:00Z',
  expires_at: '2024-03-08T00:00:00Z',
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
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

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
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      await useHouseholdStore.getState().fetchHouseholds()

      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)
    })

    it('이미 activeHouseholdId가 설정된 경우 기존 가구를 유지한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1, mockHousehold2],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

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
      } as unknown as Awaited<ReturnType<typeof householdApi.createHousehold>>)

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

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.deleteHousehold).mockRejectedValueOnce(new Error('삭제 실패'))

      useHouseholdStore.setState({
        households: [mockHousehold1],
        activeHouseholdId: 1,
      })

      await expect(useHouseholdStore.getState().deleteHousehold(1)).rejects.toThrow('삭제 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('삭제 실패')
      // 실패 시 목록은 변경되지 않는다
      expect(state.households).toHaveLength(1)
    })

    it('currentHousehold가 삭제 대상이면 null로 초기화한다', async () => {
      vi.mocked(householdApi.deleteHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.deleteHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
        activeHouseholdId: 1,
        currentHousehold: mockHouseholdDetail1,
      })

      await useHouseholdStore.getState().deleteHousehold(1)

      expect(useHouseholdStore.getState().currentHousehold).toBeNull()
    })
  })

  // ============================================================
  // fetchHouseholdDetail
  // ============================================================

  describe('fetchHouseholdDetail', () => {
    it('가구 상세 정보를 불러와 스토어에 저장한다', async () => {
      vi.mocked(householdApi.getHouseholdDetail).mockResolvedValueOnce({
        data: mockHouseholdDetail1,
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholdDetail>>)

      await useHouseholdStore.getState().fetchHouseholdDetail(1)

      const state = useHouseholdStore.getState()
      expect(state.currentHousehold).toEqual(mockHouseholdDetail1)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('API 오류 시 currentHousehold를 null로 설정하고 예외를 던진다', async () => {
      vi.mocked(householdApi.getHouseholdDetail).mockRejectedValueOnce(
        new Error('상세 조회 실패')
      )

      await expect(useHouseholdStore.getState().fetchHouseholdDetail(999)).rejects.toThrow(
        '상세 조회 실패'
      )

      const state = useHouseholdStore.getState()
      expect(state.currentHousehold).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('상세 조회 실패')
    })
  })

  // ============================================================
  // updateHousehold
  // ============================================================

  describe('updateHousehold', () => {
    it('가구 정보를 수정하고 목록을 갱신한다', async () => {
      const updatedHousehold = { ...mockHousehold1, name: '수정된 가계부' }
      vi.mocked(householdApi.updateHousehold).mockResolvedValueOnce({
        data: updatedHousehold,
      } as unknown as Awaited<ReturnType<typeof householdApi.updateHousehold>>)

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
      })

      await useHouseholdStore.getState().updateHousehold(1, { name: '수정된 가계부' })

      const state = useHouseholdStore.getState()
      expect(state.households[0].name).toBe('수정된 가계부')
      expect(state.households[1]).toEqual(mockHousehold2) // 다른 가구는 그대로
      expect(state.isMutating).toBe(false)
    })

    it('currentHousehold가 수정 대상이면 함께 갱신한다', async () => {
      const updatedHousehold = { ...mockHousehold1, name: '수정된 가계부' }
      vi.mocked(householdApi.updateHousehold).mockResolvedValueOnce({
        data: updatedHousehold,
      } as unknown as Awaited<ReturnType<typeof householdApi.updateHousehold>>)

      useHouseholdStore.setState({
        households: [mockHousehold1],
        currentHousehold: mockHouseholdDetail1,
      })

      await useHouseholdStore.getState().updateHousehold(1, { name: '수정된 가계부' })

      expect(useHouseholdStore.getState().currentHousehold?.name).toBe('수정된 가계부')
    })

    it('currentHousehold가 다른 가구이면 변경하지 않는다', async () => {
      const updatedHousehold = { ...mockHousehold1, name: '수정된 가계부' }
      vi.mocked(householdApi.updateHousehold).mockResolvedValueOnce({
        data: updatedHousehold,
      } as unknown as Awaited<ReturnType<typeof householdApi.updateHousehold>>)

      const otherDetail = { ...mockHouseholdDetail1, id: 99, name: '다른 가구' }
      useHouseholdStore.setState({
        households: [mockHousehold1],
        currentHousehold: otherDetail,
      })

      await useHouseholdStore.getState().updateHousehold(1, { name: '수정된 가계부' })

      expect(useHouseholdStore.getState().currentHousehold?.name).toBe('다른 가구')
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.updateHousehold).mockRejectedValueOnce(new Error('수정 실패'))

      await expect(
        useHouseholdStore.getState().updateHousehold(1, { name: '테스트' })
      ).rejects.toThrow('수정 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('수정 실패')
    })
  })

  // ============================================================
  // 멤버 관리
  // ============================================================

  describe('updateMemberRole', () => {
    it('멤버 역할을 변경하고 상세 정보를 다시 조회한다', async () => {
      vi.mocked(householdApi.updateMemberRole).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.updateMemberRole>>
      )
      vi.mocked(householdApi.getHouseholdDetail).mockResolvedValueOnce({
        data: mockHouseholdDetail1,
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholdDetail>>)

      await useHouseholdStore.getState().updateMemberRole(1, 10, 'admin')

      expect(householdApi.updateMemberRole).toHaveBeenCalledWith(1, 10, 'admin')
      expect(householdApi.getHouseholdDetail).toHaveBeenCalledWith(1)
      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.updateMemberRole).mockRejectedValueOnce(
        new Error('역할 변경 실패')
      )

      await expect(
        useHouseholdStore.getState().updateMemberRole(1, 10, 'admin')
      ).rejects.toThrow('역할 변경 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('역할 변경 실패')
    })
  })

  describe('removeMember', () => {
    it('멤버를 내보내고 상세 정보를 다시 조회한다', async () => {
      vi.mocked(householdApi.removeMember).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.removeMember>>
      )
      vi.mocked(householdApi.getHouseholdDetail).mockResolvedValueOnce({
        data: mockHouseholdDetail1,
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholdDetail>>)

      await useHouseholdStore.getState().removeMember(1, 20)

      expect(householdApi.removeMember).toHaveBeenCalledWith(1, 20)
      expect(householdApi.getHouseholdDetail).toHaveBeenCalledWith(1)
      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.removeMember).mockRejectedValueOnce(
        new Error('내보내기 실패')
      )

      await expect(
        useHouseholdStore.getState().removeMember(1, 20)
      ).rejects.toThrow('내보내기 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('내보내기 실패')
    })
  })

  describe('leaveHousehold', () => {
    it('가구를 탈퇴하고 목록에서 제거한다', async () => {
      vi.mocked(householdApi.leaveHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.leaveHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
        activeHouseholdId: 1,
      })

      await useHouseholdStore.getState().leaveHousehold(1)

      const state = useHouseholdStore.getState()
      expect(state.households).toHaveLength(1)
      expect(state.households[0].id).toBe(2)
      // 탈퇴한 가구가 활성 가구였으므로 다른 가구로 전환
      expect(state.activeHouseholdId).toBe(2)
      expect(state.isMutating).toBe(false)
    })

    it('탈퇴 시 currentHousehold가 해당 가구이면 null로 초기화한다', async () => {
      vi.mocked(householdApi.leaveHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.leaveHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1, mockHousehold2],
        activeHouseholdId: 1,
        currentHousehold: mockHouseholdDetail1,
      })

      await useHouseholdStore.getState().leaveHousehold(1)

      expect(useHouseholdStore.getState().currentHousehold).toBeNull()
    })

    it('마지막 가구를 탈퇴하면 activeHouseholdId가 null이 된다', async () => {
      vi.mocked(householdApi.leaveHousehold).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.leaveHousehold>>
      )

      useHouseholdStore.setState({
        households: [mockHousehold1],
        activeHouseholdId: 1,
      })

      await useHouseholdStore.getState().leaveHousehold(1)

      expect(useHouseholdStore.getState().households).toHaveLength(0)
      expect(useHouseholdStore.getState().activeHouseholdId).toBeNull()
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.leaveHousehold).mockRejectedValueOnce(
        new Error('탈퇴 실패')
      )

      await expect(
        useHouseholdStore.getState().leaveHousehold(1)
      ).rejects.toThrow('탈퇴 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('탈퇴 실패')
    })
  })

  // ============================================================
  // 초대 관리
  // ============================================================

  describe('inviteMember', () => {
    it('멤버를 초대하고 초대 정보를 반환한다', async () => {
      vi.mocked(householdApi.createInvitation).mockResolvedValueOnce({
        data: mockInvitation,
      } as unknown as Awaited<ReturnType<typeof householdApi.createInvitation>>)

      const result = await useHouseholdStore.getState().inviteMember(1, { email: 'test@example.com' })

      expect(result).toEqual(mockInvitation)
      expect(householdApi.createInvitation).toHaveBeenCalledWith(1, { email: 'test@example.com' })
      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.createInvitation).mockRejectedValueOnce(
        new Error('초대 실패')
      )

      await expect(
        useHouseholdStore.getState().inviteMember(1, { email: 'test@example.com' })
      ).rejects.toThrow('초대 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('초대 실패')
    })
  })

  describe('fetchMyInvitations', () => {
    it('내가 받은 초대 목록을 불러와 스토어에 저장한다', async () => {
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [mockInvitation],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      await useHouseholdStore.getState().fetchMyInvitations()

      expect(useHouseholdStore.getState().myInvitations).toEqual([mockInvitation])
    })

    it('API 오류 시 에러를 설정하고 예외를 던진다', async () => {
      vi.mocked(householdApi.getMyInvitations).mockRejectedValueOnce(
        new Error('초대 목록 조회 실패')
      )

      await expect(
        useHouseholdStore.getState().fetchMyInvitations()
      ).rejects.toThrow('초대 목록 조회 실패')

      expect(useHouseholdStore.getState().error).toBe('초대 목록 조회 실패')
    })
  })

  describe('fetchHouseholdInvitations', () => {
    it('가구의 초대 목록을 불러와 스토어에 저장한다', async () => {
      vi.mocked(householdApi.getHouseholdInvitations).mockResolvedValueOnce({
        data: [mockInvitation],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholdInvitations>>)

      await useHouseholdStore.getState().fetchHouseholdInvitations(1)

      expect(useHouseholdStore.getState().householdInvitations).toEqual([mockInvitation])
    })

    it('API 오류 시 빈 배열로 설정한다 (에러 무시)', async () => {
      vi.mocked(householdApi.getHouseholdInvitations).mockRejectedValueOnce(
        new Error('조회 실패')
      )

      // fetchHouseholdInvitations은 에러를 throw하지 않고 빈 배열로 설정
      await useHouseholdStore.getState().fetchHouseholdInvitations(1)

      expect(useHouseholdStore.getState().householdInvitations).toEqual([])
    })
  })

  describe('acceptInvitation', () => {
    it('초대를 수락하고 가구 목록과 초대 목록을 다시 조회한다', async () => {
      const acceptResponse = { household_id: 1, household_name: '우리집 가계부' }
      vi.mocked(householdApi.acceptInvitation).mockResolvedValueOnce({
        data: acceptResponse,
      } as unknown as Awaited<ReturnType<typeof householdApi.acceptInvitation>>)
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      const result = await useHouseholdStore.getState().acceptInvitation('test-token')

      expect(result).toEqual(acceptResponse)
      expect(householdApi.acceptInvitation).toHaveBeenCalledWith('test-token')
      // fetchHouseholds + fetchMyInvitations 호출 확인
      expect(householdApi.getHouseholds).toHaveBeenCalled()
      expect(householdApi.getMyInvitations).toHaveBeenCalled()
      expect(useHouseholdStore.getState().isMutating).toBe(false)
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.acceptInvitation).mockRejectedValueOnce(
        new Error('수락 실패')
      )

      await expect(
        useHouseholdStore.getState().acceptInvitation('invalid-token')
      ).rejects.toThrow('수락 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('수락 실패')
    })
  })

  describe('rejectInvitation', () => {
    it('초대를 거절하고 초대 목록을 다시 조회한다', async () => {
      vi.mocked(householdApi.rejectInvitation).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.rejectInvitation>>
      )
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      await useHouseholdStore.getState().rejectInvitation('test-token')

      expect(householdApi.rejectInvitation).toHaveBeenCalledWith('test-token')
      expect(householdApi.getMyInvitations).toHaveBeenCalled()
      expect(useHouseholdStore.getState().isMutating).toBe(false)
      expect(useHouseholdStore.getState().myInvitations).toEqual([])
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.rejectInvitation).mockRejectedValueOnce(
        new Error('거절 실패')
      )

      await expect(
        useHouseholdStore.getState().rejectInvitation('invalid-token')
      ).rejects.toThrow('거절 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('거절 실패')
    })
  })

  describe('cancelInvitation', () => {
    it('초대를 취소하고 가구 초대 목록을 다시 조회한다', async () => {
      vi.mocked(householdApi.cancelInvitation).mockResolvedValueOnce(
        undefined as unknown as Awaited<ReturnType<typeof householdApi.cancelInvitation>>
      )
      vi.mocked(householdApi.getHouseholdInvitations).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholdInvitations>>)

      await useHouseholdStore.getState().cancelInvitation(1, 100)

      expect(householdApi.cancelInvitation).toHaveBeenCalledWith(1, 100)
      expect(householdApi.getHouseholdInvitations).toHaveBeenCalledWith(1)
      expect(useHouseholdStore.getState().isMutating).toBe(false)
      expect(useHouseholdStore.getState().householdInvitations).toEqual([])
    })

    it('API 오류 시 isMutating=false로 복원하고 예외를 던진다', async () => {
      vi.mocked(householdApi.cancelInvitation).mockRejectedValueOnce(
        new Error('취소 실패')
      )

      await expect(
        useHouseholdStore.getState().cancelInvitation(1, 100)
      ).rejects.toThrow('취소 실패')

      const state = useHouseholdStore.getState()
      expect(state.isMutating).toBe(false)
      expect(state.error).toBe('취소 실패')
    })
  })

  // ============================================================
  // initializeApp
  // ============================================================

  describe('initializeApp', () => {
    it('가구 목록과 초대 목록을 동시에 조회한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [mockInvitation],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      await useHouseholdStore.getState().initializeApp()

      const state = useHouseholdStore.getState()
      expect(state.households).toHaveLength(1)
      expect(state.myInvitations).toHaveLength(1)
      expect(state.hasInitialized).toBe(true)
    })

    it('이미 초기화되었으면 재실행하지 않는다', async () => {
      useHouseholdStore.setState({ hasInitialized: true })

      await useHouseholdStore.getState().initializeApp()

      // API가 호출되지 않아야 한다
      expect(householdApi.getHouseholds).not.toHaveBeenCalled()
      expect(householdApi.getMyInvitations).not.toHaveBeenCalled()
    })

    it('동시 호출 시 중복 실행되지 않는다 (Promise 캐시)', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      // 동시에 두 번 호출
      const promise1 = useHouseholdStore.getState().initializeApp()
      const promise2 = useHouseholdStore.getState().initializeApp()

      await Promise.all([promise1, promise2])

      // getHouseholds는 한 번만 호출되어야 한다
      expect(householdApi.getHouseholds).toHaveBeenCalledTimes(1)
    })

    it('fetchHouseholds 실패 시에도 hasInitialized=true가 설정된다', async () => {
      vi.mocked(householdApi.getHouseholds).mockRejectedValueOnce(
        new Error('네트워크 오류')
      )
      vi.mocked(householdApi.getMyInvitations).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getMyInvitations>>)

      await useHouseholdStore.getState().initializeApp()

      // fetchHouseholds 내부에서 hasInitialized=true 설정
      expect(useHouseholdStore.getState().hasInitialized).toBe(true)
    })
  })

  // ============================================================
  // fetchHouseholds 추가 엣지 케이스
  // ============================================================

  describe('fetchHouseholds 추가 케이스', () => {
    it('activeHouseholdId가 목록에 없으면 첫 번째 가구로 재설정한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [mockHousehold1, mockHousehold2],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      // 존재하지 않는 가구 ID 설정
      useHouseholdStore.setState({ activeHouseholdId: 999 })

      await useHouseholdStore.getState().fetchHouseholds()

      // 목록에 없으므로 첫 번째 가구로 재설정
      expect(useHouseholdStore.getState().activeHouseholdId).toBe(1)
    })

    it('빈 목록 응답 시 activeHouseholdId를 null로 설정한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockResolvedValueOnce({
        data: [],
      } as unknown as Awaited<ReturnType<typeof householdApi.getHouseholds>>)

      await useHouseholdStore.getState().fetchHouseholds()

      expect(useHouseholdStore.getState().activeHouseholdId).toBeNull()
      expect(useHouseholdStore.getState().households).toHaveLength(0)
    })

    it('Error가 아닌 예외 시 기본 에러 메시지를 설정한다', async () => {
      vi.mocked(householdApi.getHouseholds).mockRejectedValueOnce('문자열 에러')

      await expect(useHouseholdStore.getState().fetchHouseholds()).rejects.toBe('문자열 에러')

      expect(useHouseholdStore.getState().error).toBe('목록 조회 중 오류가 발생했습니다')
    })
  })
})
