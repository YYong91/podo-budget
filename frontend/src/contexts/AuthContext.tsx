/**
 * @file AuthContext.tsx
 * @description podo-auth SSO 기반 인증 상태 관리 Context
 *
 * podo-bookshelf 와 동일한 패턴:
 * - token → useState 초기화 시 쿠키/localStorage에서 동기적으로 읽음
 * - isAuthenticated = !!token (API 호출 없이 즉시 결정)
 * - user 프로필은 별도로 비동기 로드 (username, telegram 상태 등)
 *
 * 이전 패턴의 문제:
 * - /auth/me API 호출 결과가 user 상태를 결정 → 네트워크 오류 시 user=null
 * - ProtectedRoute가 user=null+hasToken=true 상태를 "서버 연결 중"으로 처리
 * - 3초 reload 타이머가 반복되며 무한 리다이렉트 루프 발생
 */

import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import authApi from '../api/auth'
import apiClient from '../api/client'

interface AuthContextType {
  /** 현재 로그인한 사용자 프로필 (API로 로드, null이면 로딩 중이거나 미로그인) */
  user: User | null
  /** 토큰 기반 인증 상태 — 동기적, API 호출 불필요 */
  isAuthenticated: boolean
  /** 사용자 프로필 로딩 상태 */
  loading: boolean
  /** 로그아웃 함수 */
  logout: () => void
  /** 사용자 정보 새로고침 (텔레그램 연동 상태 변경 후 호출) */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function getCookieToken(): string | null {
  // 1. 쿠키 우선 (Chrome/Android 등)
  const cookieMatch = document.cookie.match(/(?:^|; )podo_access_token=([^;]+)/)
  if (cookieMatch) return cookieMatch[1]
  // 2. localStorage 폴백 (iOS Safari ITP가 JS 쿠키를 공유 못하는 경우)
  try {
    return localStorage.getItem('podo_access_token')
  } catch {
    return null
  }
}

function clearCookieToken(): void {
  const hostname = window.location?.hostname || ''
  const domain = hostname.endsWith('podonest.com') ? '.podonest.com' : ''
  const domainAttr = domain ? `Domain=${domain}; ` : ''
  const secure = window.location.protocol === 'https:' ? 'Secure; ' : ''
  document.cookie = `podo_access_token=; ${domainAttr}${secure}SameSite=Lax; Path=/; Max-Age=0`
  try { localStorage.removeItem('podo_access_token') } catch { /* localStorage 미지원 환경 무시 */ }
}

/**
 * AuthContext Provider 컴포넌트
 * 애플리케이션 최상위에서 감싸서 사용한다
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // token: 쿠키/localStorage에서 동기적으로 초기화 (podo-bookshelf 패턴)
  const [token, setToken] = useState<string | null>(() => {
    const stored = getCookieToken()
    if (!stored || isTokenExpired(stored)) return null
    return stored
  })

  // user 프로필: API에서 비동기 로드 (인증 결정에는 영향 없음)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  // isAuthenticated: token 유무로 즉시 결정 (API 호출 없음)
  const isAuthenticated = useMemo(() => !!token, [token])

  // axios interceptor: Authorization 헤더 자동 추가 및 401 처리
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete apiClient.defaults.headers.common['Authorization']
    }

    // 요청 인터셉터: 쿠키/localStorage에서 토큰을 읽어 자동으로 헤더에 추가
    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        const t = getCookieToken()
        if (t) {
          config.headers.Authorization = `Bearer ${t}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 응답 인터셉터: 401 에러 시 토큰 클리어 (ProtectedRoute가 리다이렉트 처리)
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          clearCookieToken()
          setToken(null)
          setUser(null)
        }
        return Promise.reject(error)
      }
    )

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor)
      apiClient.interceptors.response.eject(responseInterceptor)
    }
  }, [token])

  // 토큰이 있을 때 사용자 프로필 로드 (인증 결정과 분리)
  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    authApi.getCurrentUser()
      .then((response) => setUser(response.data))
      .catch(() => {
        // 프로필 로드 실패는 인증 상태에 영향 없음
        // 401은 위 interceptor에서 처리 (setToken(null))
      })
      .finally(() => setLoading(false))
  }, [token])

  // 주기적으로 토큰 만료 체크 (5분마다, podo-bookshelf 패턴)
  useEffect(() => {
    const checkToken = () => {
      const current = getCookieToken()
      if (!current || isTokenExpired(current)) {
        setToken(null)
        setUser(null)
      } else if (current !== token) {
        setToken(current)
      }
    }
    const interval = setInterval(checkToken, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [token])

  const logout = () => {
    setToken(null)
    setUser(null)
    clearCookieToken()
    const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
    window.location.href = `${authUrl}/logout`
  }

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser()
      setUser(response.data)
    } catch {
      // 무시 (interceptor에서 401 처리)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth 커스텀 훅
 * @throws AuthProvider 외부에서 사용 시 에러 발생
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
