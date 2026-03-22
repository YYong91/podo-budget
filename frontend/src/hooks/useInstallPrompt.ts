/**
 * @file useInstallPrompt.ts
 * @description PWA 설치 프롬프트 관리 훅
 */

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-banner-dismissed'

export function useInstallPrompt() {
  // main.tsx에서 React 마운트 전에 캡처한 이벤트를 초기값으로 사용
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => window.__pwaInstallPrompt as BeforeInstallPromptEvent | null
  )
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )
  const [isIOS] = useState(() =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  )
  const [isDismissed, setIsDismissed] = useState(() =>
    localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      window.__pwaInstallPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismissBanner = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [])

  return {
    deferredPrompt,
    isInstalled,
    isIOS,
    isBannerVisible: !isInstalled && !isDismissed,
    promptInstall,
    dismissBanner,
  }
}
