/**
 * @file AuthContext.tsx
 * @description 인증 상태 관리 Context
 * 로그인/로그아웃, 토큰 저장, axios interceptor를 통한 자동 인증 헤더 추가를 제공한다.
 */

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User, LoginRequest, RegisterRequest } from '../types'
import authApi from '../api/auth'
import apiClient from '../api/client'

interface AuthContextType {
  /** 현재 로그인한 사용자 정보 (null이면 미로그인) */
  user: User | null
  /** 로딩 상태 */
  loading: boolean
  /**
   * 로그인 함수
   * @param data - 사용자명과 비밀번호
   * @throws API 에러 시 throw
   */
  login: (data: LoginRequest) => Promise<void>
  /**
   * 회원가입 함수
   * @param data - 사용자명과 비밀번호
   * @throws API 에러 시 throw
   */
  register: (data: RegisterRequest) => Promise<void>
  /**
   * 로그아웃 함수
   * localStorage의 토큰을 제거하고 user를 null로 설정한다
   */
  logout: () => void
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

  // axios interceptor: Authorization 헤더 자동 추가
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // 요청 인터셉터: 토큰이 있으면 자동으로 헤더에 추가
    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(TOKEN_KEY)
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 응답 인터셉터: 401 에러 시 자동 로그아웃
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // 인증 실패 시 토큰 제거 및 로그아웃
          localStorage.removeItem(TOKEN_KEY)
          setUser(null)
          delete apiClient.defaults.headers.common['Authorization']
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
      } catch (error) {
        console.error('Failed to load user:', error)
        localStorage.removeItem(TOKEN_KEY)
        delete apiClient.defaults.headers.common['Authorization']
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data)
    const { access_token } = response.data

    // 토큰 저장
    localStorage.setItem(TOKEN_KEY, access_token)
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

    // 사용자 정보 조회
    const userResponse = await authApi.getCurrentUser()
    setUser(userResponse.data)
  }

  const register = async (data: RegisterRequest) => {
    await authApi.register(data)
    // 회원가입 후 자동 로그인
    await login({ email: data.email, password: data.password })
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    delete apiClient.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth 커스텀 훅
 * 컴포넌트에서 인증 기능을 사용하기 위한 훅
 * @throws AuthProvider 외부에서 사용 시 에러 발생
 * @returns user, loading, login, register, logout 함수를 포함한 객체
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
