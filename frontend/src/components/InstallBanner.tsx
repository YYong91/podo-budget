/**
 * @file InstallBanner.tsx
 * @description PWA 설치 유도 하단 배너
 */

import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import IosInstallGuide from './IosInstallGuide'

export default function InstallBanner() {
  const { isIOS, isBannerVisible, deferredPrompt, promptInstall, dismissBanner } = useInstallPrompt()
  const [showIosGuide, setShowIosGuide] = useState(false)

  if (!isBannerVisible) return null

  const handleInstall = () => {
    if (isIOS) {
      setShowIosGuide(true)
    } else if (deferredPrompt) {
      promptInstall()
    }
  }

  return (
    <>
      <div className="fixed bottom-16 md:bottom-4 left-4 right-4 z-40 mx-auto max-w-md animate-slide-up">
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-lg border border-[var(--border-default)] p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-grape-50 flex items-center justify-center">
            <img src="/pwa-64x64.png" alt="" className="w-7 h-7 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">앱으로 설치</p>
            <p className="text-xs text-[var(--text-tertiary)]">홈 화면에서 바로 실행하세요</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 px-3 py-1.5 bg-grape-600 text-white text-xs font-semibold rounded-lg hover:bg-grape-700 transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            {isIOS ? '방법 보기' : '설치'}
          </button>
          <button
            onClick={dismissBanner}
            aria-label="배너 닫기"
            className="flex-shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} />}
    </>
  )
}
