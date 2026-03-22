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
})
