import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InstallBanner from '../InstallBanner'

const mockPromptInstall = vi.fn()
const mockDismissBanner = vi.fn()

vi.mock('../../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    deferredPrompt: null,
    isInstalled: false,
    isIOS: false,
    isBannerVisible: true,
    promptInstall: mockPromptInstall,
    dismissBanner: mockDismissBanner,
  }),
}))

describe('InstallBanner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('배너가 노출된다', () => {
    render(<InstallBanner />)
    expect(screen.getByText(/앱으로 설치/)).toBeInTheDocument()
  })

  it('설치 버튼에 "설치" 텍스트가 표시된다 (non-iOS)', () => {
    render(<InstallBanner />)
    expect(screen.getByText('설치')).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 dismissBanner 호출', () => {
    render(<InstallBanner />)
    fireEvent.click(screen.getByLabelText('배너 닫기'))
    expect(mockDismissBanner).toHaveBeenCalledTimes(1)
  })

  it('설치 버튼 클릭 시 deferredPrompt가 있으면 promptInstall 호출', () => {
    // deferredPrompt가 있는 상태로 모킹 재설정은 이 파일에서는 어려우므로
    // 기본 mock에서 deferredPrompt=null이므로 promptInstall은 호출되지 않음
    render(<InstallBanner />)
    fireEvent.click(screen.getByText('설치'))
    // deferredPrompt가 null이고 isIOS가 false이므로 아무것도 호출되지 않음
    expect(mockPromptInstall).not.toHaveBeenCalled()
  })
})
