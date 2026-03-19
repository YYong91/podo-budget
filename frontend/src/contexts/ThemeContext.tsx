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
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
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

/** DOM에만 테마를 적용하는 순수 함수 (state 변경 없음)
 *
 * useEffect 내부에서 호출해도 cascading render가 발생하지 않는다.
 * setResolvedTheme은 외부 이벤트(사용자 액션, OS 변경) 핸들러에서만 호출한다.
 */
function applyThemeToDom(resolved: 'light' | 'dark') {
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
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getInitialMode()))

  const setMode = useCallback((newMode: ThemeMode) => {
    const resolved = resolveTheme(newMode)
    setModeState(newMode)
    setResolvedTheme(resolved)
    localStorage.setItem(STORAGE_KEY, newMode)
    applyThemeToDom(resolved)
  }, [])

  // 마운트 시 초기 테마 DOM 적용 (FOUC 방지)
  // state는 이미 초기화되어 있으므로 DOM 업데이트만 수행한다
  useEffect(() => {
    applyThemeToDom(resolvedTheme)
  }, [resolvedTheme])

  // system 모드일 때 OS 설정 변경 감지
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light'
      setResolvedTheme(resolved)
      applyThemeToDom(resolved)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

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
