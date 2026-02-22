/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트
 * 로그인하지 않은 사용자는 podo-auth 로그인 페이지로 리다이렉트한다.
 */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute 컴포넌트
 * @returns 인증된 사용자면 자식 라우트를 렌더링하고, 아니면 podo-auth로 리다이렉트
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      sessionStorage.setItem(
        'intended_path',
        window.location.pathname + window.location.search
      )
      const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
      const callbackUrl = import.meta.env.VITE_AUTH_CALLBACK_URL || `${window.location.origin}/auth/callback`
      window.location.href = `${authUrl}/login?redirect_uri=${encodeURIComponent(callbackUrl)}`
    }
  }, [loading, user])

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

  // 인증되지 않은 사용자는 null 반환 (useEffect에서 리다이렉트 처리)
  if (!user) {
    return null
  }

  // 인증된 사용자는 자식 라우트 렌더링
  return <Outlet />
}
