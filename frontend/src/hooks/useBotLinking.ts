/**
 * @file useBotLinking.ts
 * @description 텔레그램/카카오 봇 연동 로직을 공통화하는 훅
 * SettingsPage의 텔레그램·카카오 연동 코드 생성/해제/복사 로직이 95% 동일하여 추출.
 */

import { useState, useCallback } from 'react'
import { generateTelegramLinkCode, unlinkTelegram } from '../api/telegram'
import { generateKakaoLinkCode, unlinkKakao } from '../api/kakao'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './useToast'
import { TOAST } from '../constants/toastMessages'
import { trackEvent } from '../utils/analytics'

type Platform = 'telegram' | 'kakao'

interface LinkCode {
  code: string
  expires_at: string
}

/** 플랫폼별 설정 — API 함수, 이벤트명, 복사 포맷, 표시명 */
const PLATFORM_CONFIG = {
  telegram: {
    generateCode: generateTelegramLinkCode,
    unlinkApi: unlinkTelegram,
    trackEventName: 'telegram_linked' as const,
    /** 클립보드 복사 시 포맷 (코드만 전달) */
    copyFormat: (code: string) => `/link ${code}`,
    displayName: '텔레그램',
  },
  kakao: {
    generateCode: generateKakaoLinkCode,
    unlinkApi: unlinkKakao,
    trackEventName: 'kakao_linked' as const,
    copyFormat: (code: string) => `연동 ${code}`,
    displayName: '카카오톡',
  },
} as const

export function useBotLinking(platform: Platform) {
  const { refreshUser } = useAuth()
  const { addToast } = useToast()

  const [linkCode, setLinkCode] = useState<LinkCode | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingUnlink, setLoadingUnlink] = useState(false)

  const config = PLATFORM_CONFIG[platform]

  const generateCode = useCallback(async () => {
    setLoadingCode(true)
    try {
      const data = await config.generateCode()
      setLinkCode(data)
      trackEvent(config.trackEventName)
    } catch {
      addToast('error', TOAST.PROCESS_FAILED)
    } finally {
      setLoadingCode(false)
    }
  }, [config, addToast])

  const unlink = useCallback(async () => {
    if (!confirm(`${config.displayName} 연동을 해제할까요?`)) return
    setLoadingUnlink(true)
    try {
      await config.unlinkApi()
      addToast('success', TOAST.BOT_UNLINKED(config.displayName))
      await refreshUser()
      setLinkCode(null)
    } catch {
      addToast('error', TOAST.PROCESS_FAILED)
    } finally {
      setLoadingUnlink(false)
    }
  }, [config, addToast, refreshUser])

  const copyCode = useCallback(async () => {
    if (!linkCode) return
    try {
      await navigator.clipboard.writeText(config.copyFormat(linkCode.code))
      addToast('success', TOAST.LINK_CODE_COPIED)
    } catch {
      addToast('error', TOAST.PROCESS_FAILED)
    }
  }, [linkCode, config, addToast])

  return { linkCode, generateCode, unlink, copyCode, loadingCode, loadingUnlink }
}
