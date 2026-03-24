/**
 * @file AuthCallbackPage.tsx
 * @description Supabase OAuth 콜백 페이지 (#337)
 *
 * Google/Kakao 소셜 로그인 후 Supabase가 이 페이지로 리디렉션합니다.
 * Supabase JS SDK가 URL의 토큰을 자동으로 파싱하여 세션을 설정합니다.
 * onAuthStateChange에서 세션이 설정되면 AuthContext가 자동 업데이트.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { trackEvent } from '../utils/analytics'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      trackEvent('login')
      const intendedPath = sessionStorage.getItem('intended_path') || '/'
      sessionStorage.removeItem('intended_path')
      navigate(intendedPath, { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-10 h-10" />
        <p className="text-sm text-[var(--text-tertiary)]">로그인 처리 중...</p>
      </div>
    </div>
  )
}
