/**
 * @file AuthContext.tsx
 * @description podo-auth SSO 기반 인증 상태 관리 Context
 * 토큰은 podo-auth 콜백에서 localStorage에 저장되며, 이 컨텍스트는 읽기만 한다.
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
  /** 로그아웃 함수 — localStorage 클리어 후 podo-auth로 리다이렉트 */
  logout: () => void
  /** 사용자 정보 새로고침 (텔레그램 연동 상태 변경 후 호출) */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'

/**
 * AuthContext Provider 컴포넌트
 * 애플리케이션 최상위에서 감싸서 사용한다
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // axios interceptor: Authorization 헤더 자동 추가 및 401 처리
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // 요청 인터셉터: 토큰이 있으면 자동으로 헤더에 추가
    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        const t = localStorage.getItem(TOKEN_KEY)
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
          localStorage.removeItem(TOKEN_KEY)
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

  // 초기 로드 시 토큰이 있으면 사용자 정보 조회
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await authApi.getCurrentUser()
        setUser(response.data)
      } catch {
        // 401 응답 시 인터셉터에서 처리됨
        localStorage.removeItem(TOKEN_KEY)
        delete apiClient.defaults.headers.common['Authorization']
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    delete apiClient.defaults.headers.common['Authorization']
    setUser(null)
    const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
    window.location.href = `${authUrl}/login`
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
