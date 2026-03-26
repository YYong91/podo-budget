import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../useInstallPrompt'

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    window.__pwaInstallPrompt = null
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

  it('beforeinstallprompt 이벤트를 캡처하여 deferredPrompt에 저장한다', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.deferredPrompt).toBeNull()

    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.deferredPrompt).not.toBeNull()
  })

  it('localStorage에 dismissed가 있으면 처음부터 isBannerVisible=false', () => {
    localStorage.setItem('pwa-install-banner-dismissed', 'true')
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isBannerVisible).toBe(false)
  })

  it('promptInstall 호출 시 deferredPrompt.prompt()를 호출한다', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })

    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.deferredPrompt).not.toBeNull()

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.deferredPrompt).toBeNull()
  })

  it('promptInstall 호출 시 outcome=dismissed이면 isInstalled가 false로 유지된다', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    })

    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(result.current.isInstalled).toBe(false)
    expect(result.current.deferredPrompt).toBeNull()
  })

  it('deferredPrompt가 없으면 promptInstall이 아무것도 하지 않는다', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.deferredPrompt).toBeNull()

    await act(async () => {
      await result.current.promptInstall()
    })

    // 에러 없이 완료
    expect(result.current.isInstalled).toBe(false)
  })

  it('iOS에서는 isIOS가 true다', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(true)
  })

  it('window.__pwaInstallPrompt가 초기값으로 사용된다', () => {
    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.__pwaInstallPrompt = mockEvent

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.deferredPrompt).toBe(mockEvent)

    window.__pwaInstallPrompt = null
  })
})
