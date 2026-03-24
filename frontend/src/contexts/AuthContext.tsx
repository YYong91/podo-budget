/**
 * @file AuthContext.tsx
 * @description Supabase Auth 기반 인증 상태 관리 Context (#337)
 *
 * 이전: podo-auth SSO → 쿠키/localStorage로 토큰 관리
 * 이후: Supabase Auth → supabase.auth 세션으로 관리
 *
 * Supabase가 토큰 저장/갱신/만료를 자동 처리하므로
 * 기존의 쿠키 관리, 토큰 만료 체크, BFCache 대응 등이 불필요.
 *
 * React 19 대응: effect 내 동기 setState 금지.
 * loading은 session + loadedSessionToken에서 파생(derived).
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
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [initialized, setInitialized] = useState(false)
  // loadedSessionToken: 프로필 fetch가 완료된 세션 토큰 기록
  // loading = initialized && session 있는데 아직 프로필 안 가져온 상태 (derived)
  const [loadedSessionToken, setLoadedSessionToken] = useState<string | null>(null)

  // Supabase 세션 초기화 + 변화 구독
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setInitialized(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  // axios 인터셉터
  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(
      async (config) => {
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
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
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

  // 사용자 프로필 로드 — 세션 토큰이 바뀔 때만 fetch
  // effect body에 동기 setState 없음 (React 19 대응)
  // setState는 .then/.finally 비동기 콜백에서만 호출
  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    if (token === loadedSessionToken) return

    let active = true

    authApi.getCurrentUser()
      .then((response) => {
        if (active) {
          setUserProfile(response.data)
          identifyUser(String(response.data.id))
          setLoadedSessionToken(token)
        }
      })
      .catch(() => {
        if (active) setLoadedSessionToken(token)
      })

    return () => { active = false }
  }, [session?.access_token, loadedSessionToken])

  // 파생 상태 — 동기 setState 없이 계산
  const isAuthenticated = useMemo(() => !!session?.access_token, [session])
  const user: User | null = session ? userProfile : null
  const loading: boolean = !initialized || (!!session?.access_token && session.access_token !== loadedSessionToken)

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
    () => ({ user, isAuthenticated, loading, logout, refreshUser }),
    [user, isAuthenticated, loading, logout, refreshUser],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
