/**
 * @file useHouseholdStore.ts
 * @description 공유 가계부(Household) 상태 관리 Zustand 스토어
 * Household 목록, 상세 정보, 초대 정보를 관리하고 관련 API 호출 로직을 포함한다.
 */

import { create } from 'zustand'
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
import * as householdApi from '../api/households'

/**
 * Household 스토어 상태
 */
interface HouseholdState {
  /** 내가 속한 Household 목록 */
  households: Household[]
  /** 현재 선택된 Household 상세 정보 */
  currentHousehold: HouseholdDetail | null
  /** 내가 받은 초대 목록 */
  myInvitations: HouseholdInvitation[]
  /** 활성 가구 ID (지출 연동용) */
  activeHouseholdId: number | null
  /** 로딩 상태 */
  isLoading: boolean
  /** 에러 메시지 */
  error: string | null
}

/**
 * Household 스토어 액션
 */
interface HouseholdActions {
  // Household CRUD
  /** Household 목록 조회 */
  fetchHouseholds: () => Promise<void>
  /** Household 상세 정보 조회 */
  fetchHouseholdDetail: (id: number) => Promise<void>
  /** Household 생성 */
  createHousehold: (data: CreateHouseholdDto) => Promise<Household>
  /** Household 수정 */
  updateHousehold: (id: number, data: UpdateHouseholdDto) => Promise<void>
  /** Household 삭제 */
  deleteHousehold: (id: number) => Promise<void>

  // 멤버 관리
  /** 멤버 역할 변경 */
  updateMemberRole: (householdId: number, userId: number, role: MemberRole) => Promise<void>
  /** 멤버 추방 */
  removeMember: (householdId: number, userId: number) => Promise<void>
  /** Household 탈퇴 */
  leaveHousehold: (householdId: number) => Promise<void>

  // 초대 관리
  /** 멤버 초대 생성 */
  inviteMember: (householdId: number, data: InviteMemberDto) => Promise<HouseholdInvitation>
  /** 내가 받은 초대 목록 조회 */
  fetchMyInvitations: () => Promise<void>
  /** 초대 수락 */
  acceptInvitation: (token: string) => Promise<AcceptInvitationResponse>
  /** 초대 거절 */
  rejectInvitation: (token: string) => Promise<void>
  /** 초대 취소 */
  cancelInvitation: (householdId: number, invitationId: number) => Promise<void>

  // 유틸리티
  /** 에러 초기화 */
  clearError: () => void
  /** 현재 Household 초기화 */
  clearCurrentHousehold: () => void
  /** 활성 가구 ID getter */
  getActiveHouseholdId: () => number | null
}

type HouseholdStore = HouseholdState & HouseholdActions

/**
 * Household 관리를 위한 Zustand 스토어
 */
export const useHouseholdStore = create<HouseholdStore>((set, get) => ({
  // ============================================================
  // 초기 상태
  // ============================================================
  households: [],
  currentHousehold: null,
  myInvitations: [],
  activeHouseholdId: null,
  isLoading: false,
  error: null,

  // ============================================================
  // Household CRUD
  // ============================================================

  /**
   * 내가 속한 Household 목록 조회
   */
  fetchHouseholds: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.getHouseholds()
      const households = response.data
      // 활성 가구가 아직 설정되지 않았으면 첫 번째 가구를 자동 선택
      const currentActive = get().activeHouseholdId
      const activeId = currentActive && households.some((h) => h.id === currentActive)
        ? currentActive
        : households.length > 0 ? households[0].id : null
      set({ households, activeHouseholdId: activeId, isLoading: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '목록 조회 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * Household 상세 정보 조회
   */
  fetchHouseholdDetail: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.getHouseholdDetail(id)
      set({ currentHousehold: response.data, isLoading: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '상세 정보 조회 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false, currentHousehold: null })
      throw error
    }
  },

  /**
   * Household 생성
   */
  createHousehold: async (data: CreateHouseholdDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.createHousehold(data)
      const newHousehold = response.data
      set((state) => ({
        households: [...state.households, newHousehold],
        isLoading: false,
      }))
      return newHousehold
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '생성 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * Household 수정
   */
  updateHousehold: async (id: number, data: UpdateHouseholdDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.updateHousehold(id, data)
      const updatedHousehold = response.data
      set((state) => ({
        households: state.households.map((h) => (h.id === id ? updatedHousehold : h)),
        currentHousehold:
          state.currentHousehold?.id === id
            ? { ...state.currentHousehold, ...updatedHousehold }
            : state.currentHousehold,
        isLoading: false,
      }))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '수정 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * Household 삭제
   */
  deleteHousehold: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.deleteHousehold(id)
      set((state) => {
        const remaining = state.households.filter((h) => h.id !== id)
        return {
          households: remaining,
          currentHousehold: state.currentHousehold?.id === id ? null : state.currentHousehold,
          activeHouseholdId: state.activeHouseholdId === id ? (remaining.length > 0 ? remaining[0].id : null) : state.activeHouseholdId,
          isLoading: false,
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // ============================================================
  // 멤버 관리
  // ============================================================

  /**
   * 멤버 역할 변경
   */
  updateMemberRole: async (householdId: number, userId: number, role: MemberRole) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.updateMemberRole(householdId, userId, role)
      // 변경 후 상세 정보 다시 조회
      await get().fetchHouseholdDetail(householdId)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '역할 변경 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * 멤버 추방
   */
  removeMember: async (householdId: number, userId: number) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.removeMember(householdId, userId)
      // 변경 후 상세 정보 다시 조회
      await get().fetchHouseholdDetail(householdId)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '멤버 추방 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * Household 탈퇴
   */
  leaveHousehold: async (householdId: number) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.leaveHousehold(householdId)
      set((state) => {
        const remaining = state.households.filter((h) => h.id !== householdId)
        return {
          households: remaining,
          currentHousehold: state.currentHousehold?.id === householdId ? null : state.currentHousehold,
          activeHouseholdId: state.activeHouseholdId === householdId ? (remaining.length > 0 ? remaining[0].id : null) : state.activeHouseholdId,
          isLoading: false,
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '탈퇴 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // ============================================================
  // 초대 관리
  // ============================================================

  /**
   * 멤버 초대 생성
   */
  inviteMember: async (householdId: number, data: InviteMemberDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.createInvitation(householdId, data)
      set({ isLoading: false })
      return response.data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '초대 생성 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * 내가 받은 초대 목록 조회
   */
  fetchMyInvitations: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.getMyInvitations()
      set({ myInvitations: response.data, isLoading: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '초대 목록 조회 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * 초대 수락
   */
  acceptInvitation: async (token: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await householdApi.acceptInvitation(token)
      // 수락 후 Household 목록과 초대 목록 다시 조회
      await Promise.all([get().fetchHouseholds(), get().fetchMyInvitations()])
      return response.data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '초대 수락 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * 초대 거절
   */
  rejectInvitation: async (token: string) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.rejectInvitation(token)
      // 거절 후 초대 목록 다시 조회
      await get().fetchMyInvitations()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '초대 거절 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  /**
   * 초대 취소
   */
  cancelInvitation: async (householdId: number, invitationId: number) => {
    set({ isLoading: true, error: null })
    try {
      await householdApi.cancelInvitation(householdId, invitationId)
      set({ isLoading: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '초대 취소 중 오류가 발생했습니다'
      set({ error: errorMessage, isLoading: false })
      throw error
    }
  },

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 에러 메시지 초기화
   */
  clearError: () => {
    set({ error: null })
  },

  /**
   * 현재 선택된 Household 초기화
   */
  clearCurrentHousehold: () => {
    set({ currentHousehold: null })
  },

  /**
   * 활성 가구 ID 반환
   */
  getActiveHouseholdId: () => {
    return get().activeHouseholdId
  },
}))
