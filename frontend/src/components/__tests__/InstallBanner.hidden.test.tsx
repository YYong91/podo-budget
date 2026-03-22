import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import InstallBanner from '../InstallBanner'

vi.mock('../../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    deferredPrompt: null,
    isInstalled: true,
    isIOS: false,
    isBannerVisible: false,
    promptInstall: vi.fn(),
    dismissBanner: vi.fn(),
  }),
}))

describe('InstallBanner (설치됨)', () => {
  it('isBannerVisible=false이면 렌더링하지 않는다', () => {
    const { container } = render(<InstallBanner />)
    expect(container.firstChild).toBeNull()
  })
})
