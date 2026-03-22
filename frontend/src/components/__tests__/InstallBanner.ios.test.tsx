import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InstallBanner from '../InstallBanner'

vi.mock('../../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    deferredPrompt: null,
    isInstalled: false,
    isIOS: true,
    isBannerVisible: true,
    promptInstall: vi.fn(),
    dismissBanner: vi.fn(),
  }),
}))

describe('InstallBanner (iOS)', () => {
  it('iOS에서 "방법 보기" 텍스트를 표시한다', () => {
    render(<InstallBanner />)
    expect(screen.getByText('방법 보기')).toBeInTheDocument()
  })

  it('iOS에서 설치 버튼 클릭 시 IosInstallGuide 모달이 열린다', () => {
    render(<InstallBanner />)
    fireEvent.click(screen.getByText('방법 보기'))
    expect(screen.getByText('앱으로 설치하기')).toBeInTheDocument()
  })
})
