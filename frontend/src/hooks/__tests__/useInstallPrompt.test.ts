import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../useInstallPrompt'

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('기본 상태에서 isInstalled=false, isBannerVisible=true', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isInstalled).toBe(false)
    expect(result.current.isBannerVisible).toBe(true)
  })

  it('standalone 모드이면 isInstalled=true, isBannerVisible=false', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isBannerVisible).toBe(false)
  })

  it('dismissBanner 호출 시 localStorage에 기록되고 isBannerVisible=false', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isBannerVisible).toBe(true)
    act(() => { result.current.dismissBanner() })
    expect(result.current.isBannerVisible).toBe(false)
    expect(localStorage.getItem('pwa-install-banner-dismissed')).toBe('true')
  })

  it('localStorage에 dismissed가 있으면 처음부터 isBannerVisible=false', () => {
    localStorage.setItem('pwa-install-banner-dismissed', 'true')
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isBannerVisible).toBe(false)
  })
})
