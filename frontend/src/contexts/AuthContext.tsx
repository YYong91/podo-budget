/**
 * @file AuthContext.tsx
 * @description Supabase Auth 기반 인증 상태 관리 Context (#337)
 *
 * 이전: podo-auth SSO → 쿠키/localStorage로 토큰 관리
 * 이후: Supabase Auth → supabase.auth 세션으로 관리
 *
 * Supabase가 토큰 저장/갱신/만료를 자동 처리하므로
 * 기존의 쿠키 관리, 토큰 만료 체크, BFCache 대응 등이 불필요.
 */

import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types'
import { supabase } from '../utils/supabase'
import authApi from '../api/auth'
import apiClient from '../api/client'
import { identifyUser } from '../utils/analytics'

interface AuthContextType {
  /** 현재 로그인한 사용자 프로필 (BE API에서 로드) */
  user: User | null
  /** Supabase 세션 기반 인증 상태 */
  isAuthenticated: boolean
  /** 사용자 프로필 로딩 상태 */
  loading: boolean
  /** 로그아웃 함수 */
  logout: () => void
  /** 사용자 정보 새로고침 */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthContext Provider 컴포넌트
 * Supabase 세션 변화를 구독하여 인증 상태를 관리한다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Supabase 세션 초기화 + 변화 구독
  useEffect(() => {
    // 1. 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setInitialized(true)
    })

    // 2. 세션 변화 구독 (로그인, 로그아웃, 토큰 갱신)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  // axios 인터셉터: Supabase access_token을 Authorization 헤더에 추가
  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(
      async (config) => {
        // 최신 세션에서 토큰 가져오기 (자동 갱신 포함)
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession?.access_token) {
          config.headers.Authorization = `Bearer ${currentSession.access_token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // 세션 갱신 시도
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            // 갱신 실패 → 로그아웃
            await supabase.auth.signOut()
            setSession(null)
          }
        }
        return Promise.reject(error)
      }
    )

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor)
      apiClient.interceptors.response.eject(responseInterceptor)
    }
  }, [])

  // 사용자 프로필 로드 (BE API) — 세션이 있을 때만
  useEffect(() => {
    if (!session?.access_token) {
      setUserProfile(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    authApi.getCurrentUser()
      .then((response) => {
        if (active) {
          setUserProfile(response.data)
          identifyUser(String(response.data.id))
        }
      })
      .catch(() => {
        // 401은 인터셉터에서 처리
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [session?.access_token])

  const isAuthenticated = useMemo(() => !!session?.access_token, [session])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUserProfile(null)
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    if (!session) return
    try {
      const response = await authApi.getCurrentUser()
      setUserProfile(response.data)
    } catch {
      // 무시
    }
  }, [session])

  const contextValue = useMemo(
    () => ({
      user: session ? userProfile : null,
      isAuthenticated,
      loading: !initialized || loading,
      logout,
      refreshUser,
    }),
    [session, userProfile, isAuthenticated, initialized, loading, logout, refreshUser],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth 커스텀 훅
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
