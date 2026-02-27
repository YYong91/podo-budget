/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트
 * 로그인하지 않은 사용자는 podo-auth 로그인 페이지로 리다이렉트한다.
 * 모바일 환경에서의 리다이렉트 루프를 방지하기 위해 쿨다운 로직을 포함한다.
 */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function getCookieToken(): string | null {
  const cookieMatch = document.cookie.match(/(?:^|; )podo_access_token=([^;]+)/)
  if (cookieMatch) return cookieMatch[1]
  try {
    return localStorage.getItem('podo_access_token')
  } catch {
    return null
  }
}

/** 리다이렉트 루프 감지 */
const AUTH_REDIRECT_COOLDOWN_MS = 10_000
function canRedirectToAuth(): boolean {
  try {
    const last = sessionStorage.getItem('last_auth_redirect')
    if (last && Date.now() - Number(last) < AUTH_REDIRECT_COOLDOWN_MS) {
      return false
    }
  } catch { /* 무시 */ }
  return true
}
function markAuthRedirect(): void {
  try { sessionStorage.setItem('last_auth_redirect', String(Date.now())) } catch { /* 무시 */ }
}

/**
 * ProtectedRoute 컴포넌트
 * @returns 인증된 사용자면 자식 라우트를 렌더링하고, 아니면 podo-auth로 리다이렉트
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  // 리다이렉트 루프 감지: 토큰 없고 쿨다운 내이면 차단 (파생 값 — setState 불필요)
  const hasToken = !loading ? !!getCookieToken() : false
  const redirectBlocked = !loading && !user && !hasToken && !canRedirectToAuth()

  useEffect(() => {
    if (!loading && !user) {
      if (!hasToken) {
        if (redirectBlocked) {
          console.warn('[ProtectedRoute] 리다이렉트 루프 감지 — auth 리다이렉트 중단')
          return
        }
        markAuthRedirect()

        // 토큰 없음: auth로 리다이렉트
        try {
          sessionStorage.setItem(
            'intended_path',
            window.location.pathname + window.location.search
          )
        } catch { /* 무시 */ }
        const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
        const callbackUrl =
          import.meta.env.VITE_AUTH_CALLBACK_URL ||
          `${window.location.origin}/auth/callback`
        window.location.href = `${authUrl}/login?redirect_uri=${encodeURIComponent(callbackUrl)}`
      } else {
        // 토큰은 있지만 백엔드 응답 실패(서버 준비 중) — 3초 후 자동 재시도
        const timer = setTimeout(() => window.location.reload(), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, user, hasToken, redirectBlocked])

  // 로딩 중일 때는 스피너 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
          <p className="text-sm text-warm-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 리다이렉트 루프 차단 시 — 수동 로그인 안내 UI
  if (redirectBlocked) {
    const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
    const callbackUrl =
      import.meta.env.VITE_AUTH_CALLBACK_URL ||
      `${window.location.origin}/auth/callback`
    const loginUrl = `${authUrl}/login?redirect_uri=${encodeURIComponent(callbackUrl)}`
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-warm-700 font-medium">로그인이 필요합니다</p>
          <p className="text-sm text-warm-500">자동 로그인에 실패했습니다. 아래 버튼을 눌러 로그인해 주세요.</p>
          <a
            href={loginUrl}
            className="px-4 py-2 bg-grape-600 text-white rounded-lg hover:bg-grape-700 transition-colors"
            onClick={() => {
              try { sessionStorage.removeItem('last_auth_redirect') } catch { /* 무시 */ }
            }}
          >
            로그인하기
          </a>
        </div>
      </div>
    )
  }

  if (!user) {
    const hasToken = !!getCookieToken()
    if (hasToken) {
      // 토큰은 있지만 백엔드 일시 중지 — 연결 대기 UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-warm-50">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
            <div>
              <p className="text-warm-700 font-medium">서버 연결 중...</p>
              <p className="text-sm text-warm-500 mt-1">잠시 후 자동으로 재시도합니다</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-grape-600 hover:text-grape-700 underline"
            >
              지금 다시 시도
            </button>
          </div>
        </div>
      )
    }
    // 토큰 없음: null 반환 (useEffect에서 리다이렉트 처리)
    return null
  }

  // 인증된 사용자는 자식 라우트 렌더링
  return <Outlet />
}
