/**
 * @file ThemeContext.test.tsx
 * @description ThemeContext(ThemeProvider + useTheme) 테스트
 *
 * - localStorage 기반 테마 초기화
 * - classList 부수효과 (.dark 클래스 토글)
 * - matchMedia prefers-color-scheme 처리
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../ThemeContext'

// matchMedia mock 헬퍼
function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((e: Partial<MediaQueryListEvent>) => void)[] = []
  const mql = {
    matches: prefersDark,
    addEventListener: (_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      listeners.push(fn)
    },
    removeEventListener: (_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      const idx = listeners.indexOf(fn)
      if (idx >= 0) listeners.splice(idx, 1)
    },
    dispatchChange: (matches: boolean) => {
      listeners.forEach((fn) => fn({ matches }))
    },
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  })
  return mql
}

/** ThemeProvider 내부 상태를 노출하는 테스트용 컴포넌트 */
function ThemeConsumer() {
  const { mode, resolvedTheme, setMode } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setMode('dark')}>다크로</button>
      <button onClick={() => setMode('light')}>라이트로</button>
      <button onClick={() => setMode('system')}>시스템으로</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    // 기본적으로 light 선호로 초기화
    mockMatchMedia(false)
    // html 클래스 초기화
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('localStorage 기반 초기화', () => {
    it('localStorage에 저장값이 없으면 system 모드로 초기화된다', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('mode').textContent).toBe('system')
    })

    it('localStorage에 "dark"가 저장되어 있으면 dark 모드로 초기화된다', () => {
      localStorage.setItem('theme', 'dark')
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('mode').textContent).toBe('dark')
      expect(screen.getByTestId('resolved').textContent).toBe('dark')
    })

    it('localStorage에 "light"가 저장되어 있으면 light 모드로 초기화된다', () => {
      localStorage.setItem('theme', 'light')
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('mode').textContent).toBe('light')
      expect(screen.getByTestId('resolved').textContent).toBe('light')
    })

    it('localStorage에 유효하지 않은 값이 있으면 system 모드로 초기화된다', () => {
      localStorage.setItem('theme', 'invalid-value')
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('mode').textContent).toBe('system')
    })
  })

  describe('classList 부수효과', () => {
    it('dark 모드로 전환하면 html에 .dark 클래스가 추가된다', async () => {
      const user = userEvent.setup()
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      await user.click(screen.getByText('다크로'))
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('light 모드로 전환하면 html에서 .dark 클래스가 제거된다', async () => {
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.add('dark')
      const user = userEvent.setup()
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      await user.click(screen.getByText('라이트로'))
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('setMode 호출 시 localStorage에 선택한 모드가 저장된다', async () => {
      const user = userEvent.setup()
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      await user.click(screen.getByText('다크로'))
      expect(localStorage.getItem('theme')).toBe('dark')

      await user.click(screen.getByText('라이트로'))
      expect(localStorage.getItem('theme')).toBe('light')
    })
  })

  describe('matchMedia prefers-color-scheme 처리', () => {
    it('system 모드에서 OS가 dark 선호이면 resolvedTheme이 dark다', () => {
      mockMatchMedia(true)
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('mode').textContent).toBe('system')
      expect(screen.getByTestId('resolved').textContent).toBe('dark')
    })

    it('system 모드에서 OS가 light 선호이면 resolvedTheme이 light다', () => {
      mockMatchMedia(false)
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('resolved').textContent).toBe('light')
    })

    it('system 모드에서 OS prefers-color-scheme 변경 이벤트에 반응한다', async () => {
      const mql = mockMatchMedia(false)
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      // 초기에는 light
      expect(screen.getByTestId('resolved').textContent).toBe('light')

      // OS가 dark로 변경되면 resolvedTheme도 dark로 변경
      act(() => {
        mql.dispatchChange(true)
      })
      expect(screen.getByTestId('resolved').textContent).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('light 고정 모드에서는 OS 변경 이벤트를 무시한다', async () => {
      localStorage.setItem('theme', 'light')
      const mql = mockMatchMedia(false)
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      // light 모드에서는 이벤트 리스너가 등록되지 않아야 함
      act(() => {
        mql.dispatchChange(true)
      })
      // light 모드이므로 여전히 light
      expect(screen.getByTestId('resolved').textContent).toBe('light')
    })
  })
})
