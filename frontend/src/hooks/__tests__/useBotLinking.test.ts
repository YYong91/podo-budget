/**
 * @file useBotLinking.test.ts
 * @description useBotLinking 훅 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/* ─── 모킹 ─── */
const mockAddToast = vi.fn()
const mockRefreshUser = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ refreshUser: mockRefreshUser }),
}))

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

const mockGenerateTelegram = vi.fn()
const mockUnlinkTelegram = vi.fn()
vi.mock('../../api/telegram', () => ({
  generateTelegramLinkCode: () => mockGenerateTelegram(),
  unlinkTelegram: () => mockUnlinkTelegram(),
}))

const mockGenerateKakao = vi.fn()
const mockUnlinkKakao = vi.fn()
vi.mock('../../api/kakao', () => ({
  generateKakaoLinkCode: () => mockGenerateKakao(),
  unlinkKakao: () => mockUnlinkKakao(),
}))

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}))

// confirm 모킹
const mockConfirm = vi.fn(() => true)
vi.stubGlobal('confirm', mockConfirm)

// clipboard 모킹
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
})

import { useBotLinking } from '../useBotLinking'

describe('useBotLinking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
  })

  describe('텔레그램', () => {
    it('초기 상태: linkCode null, 로딩 false', () => {
      const { result } = renderHook(() => useBotLinking('telegram'))
      expect(result.current.linkCode).toBeNull()
      expect(result.current.loadingCode).toBe(false)
      expect(result.current.loadingUnlink).toBe(false)
    })

    it('generateCode 성공 시 linkCode가 설정된다', async () => {
      const code = { code: 'ABC123', expires_at: '2026-03-25T12:00:00Z' }
      mockGenerateTelegram.mockResolvedValue(code)

      const { result } = renderHook(() => useBotLinking('telegram'))
      await act(() => result.current.generateCode())

      expect(result.current.linkCode).toEqual(code)
      expect(mockAddToast).not.toHaveBeenCalledWith('error', expect.any(String))
    })

    it('generateCode 실패 시 에러 토스트 표시', async () => {
      mockGenerateTelegram.mockRejectedValue(new Error('fail'))

      const { result } = renderHook(() => useBotLinking('telegram'))
      await act(() => result.current.generateCode())

      expect(result.current.linkCode).toBeNull()
      expect(mockAddToast).toHaveBeenCalledWith('error', '처리에 실패했어요')
    })

    it('unlink 성공 시 refreshUser 호출 + linkCode null 초기화', async () => {
      mockUnlinkTelegram.mockResolvedValue(undefined)
      mockRefreshUser.mockResolvedValue(undefined)

      const { result } = renderHook(() => useBotLinking('telegram'))

      // 먼저 코드 발급
      mockGenerateTelegram.mockResolvedValue({ code: 'X', expires_at: '2026-01-01T00:00:00Z' })
      await act(() => result.current.generateCode())
      expect(result.current.linkCode).not.toBeNull()

      // 연동 해제
      await act(() => result.current.unlink())

      expect(mockRefreshUser).toHaveBeenCalled()
      expect(result.current.linkCode).toBeNull()
      expect(mockAddToast).toHaveBeenCalledWith('success', '텔레그램 연동을 해제했어요')
    })

    it('unlink 시 confirm 취소하면 API 호출하지 않는다', async () => {
      mockConfirm.mockReturnValue(false)

      const { result } = renderHook(() => useBotLinking('telegram'))
      await act(() => result.current.unlink())

      expect(mockUnlinkTelegram).not.toHaveBeenCalled()
    })

    it('copyCode는 /link {code} 형식으로 클립보드 복사', async () => {
      mockGenerateTelegram.mockResolvedValue({ code: 'TG999', expires_at: '2026-01-01T00:00:00Z' })

      const { result } = renderHook(() => useBotLinking('telegram'))
      await act(() => result.current.generateCode())
      await act(() => result.current.copyCode())

      expect(mockWriteText).toHaveBeenCalledWith('/link TG999')
      expect(mockAddToast).toHaveBeenCalledWith('success', '연동 코드를 복사했어요')
    })

    it('linkCode 없으면 copyCode는 아무것도 하지 않는다', async () => {
      const { result } = renderHook(() => useBotLinking('telegram'))
      await act(() => result.current.copyCode())

      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  describe('카카오', () => {
    it('generateCode 성공 시 linkCode가 설정된다', async () => {
      const code = { code: 'KK456', expires_at: '2026-03-25T12:00:00Z' }
      mockGenerateKakao.mockResolvedValue(code)

      const { result } = renderHook(() => useBotLinking('kakao'))
      await act(() => result.current.generateCode())

      expect(result.current.linkCode).toEqual(code)
    })

    it('unlink 성공 시 카카오톡 메시지 토스트', async () => {
      mockUnlinkKakao.mockResolvedValue(undefined)
      mockRefreshUser.mockResolvedValue(undefined)

      const { result } = renderHook(() => useBotLinking('kakao'))
      await act(() => result.current.unlink())

      expect(mockAddToast).toHaveBeenCalledWith('success', '카카오톡 연동을 해제했어요')
    })

    it('copyCode는 "연동 {code}" 형식으로 클립보드 복사', async () => {
      mockGenerateKakao.mockResolvedValue({ code: 'KK789', expires_at: '2026-01-01T00:00:00Z' })

      const { result } = renderHook(() => useBotLinking('kakao'))
      await act(() => result.current.generateCode())
      await act(() => result.current.copyCode())

      expect(mockWriteText).toHaveBeenCalledWith('연동 KK789')
    })
  })
})
