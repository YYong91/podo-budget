/**
 * PWA 설치 프롬프트 훅
 * beforeinstallprompt 이벤트를 캡처하여 프로그래밍 방식으로 설치 프롬프트를 트리거한다.
 * iOS Safari는 beforeinstallprompt 미지원 → isIos 플래그로 수동 안내 폴백.
 */

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const isPwaInstalled = typeof window !== 'undefined'
    && window.matchMedia('(display-mode: standalone)').matches

  const isIos = typeof navigator !== 'undefined'
    && /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }, [deferredPrompt])

  return {
    isPwaInstalled,
    canPromptInstall: !!deferredPrompt,
    isIos,
    promptInstall,
  }
}
