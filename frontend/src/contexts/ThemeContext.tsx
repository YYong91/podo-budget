/**
 * @file ThemeContext.tsx
 * @description 다크모드 테마 상태 관리 Context
 *
 * - localStorage 'theme' 키로 사용자 설정 저장
 * - 'system' | 'light' | 'dark' 3가지 모드 지원
 * - <html> 요소에 .dark 클래스 토글
 * - PWA meta theme-color 동적 변경
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeContextType {
  /** 사용자가 선택한 테마 모드 */
  mode: ThemeMode
  /** 실제 적용되는 테마 (system일 때 OS 설정 반영) */
  resolvedTheme: 'light' | 'dark'
  /** 테마 모드 변경 */
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const STORAGE_KEY = 'theme'
const THEME_COLOR_LIGHT = '#7c3aed'
const THEME_COLOR_DARK = '#1a1625'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getInitialMode()))

  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // PWA 상태바 색상 변경
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
    }
    setResolvedTheme(resolved)
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
    applyTheme(resolveTheme(newMode))
  }, [applyTheme])

  // system 모드일 때 OS 설정 변경 감지
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode, applyTheme])

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
