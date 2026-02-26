/**
 * @file AuthContext.tsx
 * @description podo-auth SSO 기반 인증 상태 관리 Context
 * 쿠키 기반 SSO: podo_access_token 쿠키에서 토큰을 읽음 (.podonest.com 도메인 공유)
 */

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import authApi from '../api/auth'
import apiClient from '../api/client'

interface AuthContextType {
  /** 현재 로그인한 사용자 정보 (null이면 미로그인) */
  user: User | null
  /** 로딩 상태 */
  loading: boolean
  /** 로그아웃 함수 — 쿠키 클리어 후 podo-auth로 리다이렉트 */
  logout: () => void
  /** 사용자 정보 새로고침 (텔레그램 연동 상태 변경 후 호출) */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getCookieToken(): string | null {
  // 1. 쿠키 우선 (Chrome/Android 등)
  const cookieMatch = document.cookie.match(/(?:^|; )podo_access_token=([^;]+)/)
  if (cookieMatch) return cookieMatch[1]
  // 2. localStorage 폴백 (iOS Safari ITP가 JS 쿠키를 삭제하는 경우)
  try {
    return localStorage.getItem('podo_access_token')
  } catch {
    return null
  }
}

/**
 * AuthContext Provider 컴포넌트
 * 애플리케이션 최상위에서 감싸서 사용한다
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // axios interceptor: Authorization 헤더 자동 추가 및 401 처리
  useEffect(() => {
    const token = getCookieToken()
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // 요청 인터셉터: 쿠키에서 토큰을 읽어 자동으로 헤더에 추가
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

    // 응답 인터셉터: 401 에러 시 podo-auth 로그인 페이지로 리다이렉트
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          setUser(null)
          delete apiClient.defaults.headers.common['Authorization']
          const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
          const callbackUrl = import.meta.env.VITE_AUTH_CALLBACK_URL || `${window.location.origin}/auth/callback`
          window.location.href = `${authUrl}/login?redirect_uri=${encodeURIComponent(callbackUrl)}`
        }
        return Promise.reject(error)
      }
    )

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor)
      apiClient.interceptors.response.eject(responseInterceptor)
    }
  }, [])

  // 초기 로드 시 쿠키에 토큰이 있으면 사용자 정보 조회
  useEffect(() => {
    const initAuth = async () => {
      const token = getCookieToken()
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await authApi.getCurrentUser()
        setUser(response.data)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          // 401은 인터셉터에서도 처리되지만 여기서도 정리
          delete apiClient.defaults.headers.common['Authorization']
        }
        // 네트워크 에러(백엔드 일시 중지 등)는 토큰 유지 — 무한 리다이렉트 방지
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const logout = () => {
    setUser(null)
    delete apiClient.defaults.headers.common['Authorization']
    try { localStorage.removeItem('podo_access_token') } catch { /* localStorage 미지원 환경 무시 */ }
    const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
    window.location.href = `${authUrl}/logout`
  }

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser()
      setUser(response.data)
    } catch {
      // 무시 (인터셉터에서 401 처리)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
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
