/**
 * @file AuthContext.tsx
 * @description podo-auth SSO 기반 인증 상태 관리 Context
 *
 * podo-bookshelf 와 동일한 패턴:
 * - token → useState 초기화 시 쿠키/localStorage에서 동기적으로 읽음
 * - isAuthenticated = !!token (API 호출 없이 즉시 결정)
 * - user 프로필은 별도로 비동기 로드 (username, telegram 상태 등)
 *
 * react-hooks/set-state-in-effect (v7 규칙) 대응:
 * - effect body에서 동기 setState 호출 금지
 * - user/loading은 token과 loadedToken에서 파생(derived)
 * - 모든 setState는 비동기 콜백(.then, .catch) 내부에서만 호출
 *
 * Safari Private 모드 대응:
 * - tokenRef: 렌더마다 동기적으로 token 미러링 → localStorage/쿠키 없어도 Authorization 헤더 설정
 * - 401 인터셉터: Domain 쿠키 삭제 금지 → auth.podonest.com 세션 보호 (무한 루프 방지)
 */

import { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import authApi from '../api/auth'
import apiClient from '../api/client'
import { getCookieToken } from '../utils/token'

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
  /**
   * SSO 콜백에서 받은 토큰을 AuthProvider 상태에 직접 반영
   * - window.location.replace() 하드 리로드 없이 token 상태를 즉시 업데이트
   * - Safari bfcache / 구 서비스 워커 캐시 문제를 근본적으로 회피
   */
  setTokenFromCallback: (token: string) => void
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

  // tokenRef: 최신 token을 동기적으로 미러링
  // Safari Private 모드에서 localStorage/쿠키 모두 차단되어도 in-memory 토큰으로 Authorization 헤더 설정
  const tokenRef = useRef<string | null>(token)
  // eslint-disable-next-line react-hooks/refs
  tokenRef.current = token

  // userProfile: API에서 비동기 로드
  const [userProfile, setUserProfile] = useState<User | null>(null)

  // loadedToken: 프로필을 성공/실패로 fetch한 토큰을 기록
  // loading = !!token && token !== loadedToken (derived, 동기 setState 불필요)
  const [loadedToken, setLoadedToken] = useState<string | null>(null)

  // 파생 상태 — setState 없이 즉시 계산
  const isAuthenticated = useMemo(() => !!token, [token])
  const user: User | null = token ? userProfile : null   // token=null이면 user=null (derived)
  const loading: boolean = !!token && token !== loadedToken

  // axios interceptors: mount 시 1회 등록 (request: 토큰 헤더 자동 추가, response: 401 처리)
  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        // tokenRef.current 우선: Safari Private 모드 등 cookie/localStorage 모두 차단된 환경 대응
        const t = tokenRef.current ?? getCookieToken()
        if (t) {
          config.headers.Authorization = `Bearer ${t}`
        } else if (import.meta.env.DEV) {
          // 토큰 없이 요청 — 개발 환경 디버깅용 (Safari ITP/Private 모드 추적)
          console.warn('[podo-auth] 요청 토큰 없음:', config.url, {
            tokenRef: tokenRef.current,
            cookie: !!document.cookie.match(/podo_access_token/),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ls: (() => { try { return localStorage.getItem('podo_access_token') ? 'ok' : 'null' } catch { return 'blocked' } })(),
          })
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 401: 토큰 클리어 → ProtectedRoute가 리다이렉트 처리
    // 주의: clearCookieToken()으로 .podonest.com 도메인 쿠키 삭제 금지
    //   → budget.podonest.com에서 삭제 시 auth.podonest.com 세션까지 파괴 → 무한 루프
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('[podo-auth] 401 발생:', {
            url: error.config?.url,
            hasAuthHeader: !!error.config?.headers?.Authorization,
            authHeaderSnippet: String(error.config?.headers?.Authorization ?? '').substring(0, 30),
          })
          try { localStorage.removeItem('podo_access_token') } catch { /* 무시 */ }
          setToken(null)
          // user는 token=null 파생으로 자동 null
        }
        return Promise.reject(error)
      }
    )

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor)
      apiClient.interceptors.response.eject(responseInterceptor)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 사용자 프로필 로드 — effect body에 동기 setState 없음 (react-hooks/set-state-in-effect 대응)
  // token이 없거나 이미 로드된 경우 스킵, setState는 .then/.catch 콜백에서만 호출
  useEffect(() => {
    if (!token) return
    if (token === loadedToken) return

    let active = true
    authApi.getCurrentUser()
      .then((response) => {
        if (active) {
          setUserProfile(response.data)
          setLoadedToken(token)
        }
      })
      .catch(() => {
        // 프로필 로드 실패 시에도 loadedToken을 갱신해 loading 상태를 해제
        // 401은 interceptor에서 처리되어 setToken(null)이 호출됨
        if (active) setLoadedToken(token)
      })
    return () => { active = false }
  }, [token, loadedToken])

  // 주기적으로 토큰 만료 체크 (5분마다, podo-bookshelf 패턴)
  useEffect(() => {
    const checkToken = () => {
      const current = getCookieToken()
      if (!current || isTokenExpired(current)) {
        setToken(null)
      } else if (current !== token) {
        setToken(current)
      }
    }
    const interval = setInterval(checkToken, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [token])

  // BFCache 대응: iOS Safari에서 뒤로가기로 페이지 복원 시 토큰 재검증
  // persisted=true이면 React state가 이전 상태로 복원됨 → 쿠키/localStorage와 동기화
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const current = getCookieToken()
        if (!current || isTokenExpired(current)) {
          setToken(null)
        }
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // SSO 콜백 전용: 하드 리로드 없이 token 상태를 직접 업데이트
  // useCallback으로 안정적 참조 보장 → AuthCallbackPage useEffect deps에 포함 가능
  const setTokenFromCallback = useCallback((newToken: string) => {
    try {
      localStorage.setItem('podo_access_token', newToken)
      console.log('[podo-auth] 콜백 토큰 localStorage 저장 완료')
    } catch (e) {
      console.warn('[podo-auth] 콜백 토큰 localStorage 저장 실패 (Private 모드?):', (e as Error)?.name)
    }
    setToken(newToken)
  }, []) // setToken은 React가 안정적 참조를 보장하므로 deps 불필요

  const logout = () => {
    clearCookieToken()
    const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
    window.location.href = `${authUrl}/logout`
  }

  const refreshUser = async () => {
    if (!token) return
    try {
      const response = await authApi.getCurrentUser()
      setUserProfile(response.data)
    } catch {
      // 무시 (interceptor에서 401 처리)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, logout, refreshUser, setTokenFromCallback }}>
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
