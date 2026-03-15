/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트
 * podo-bookshelf 와 동일한 패턴:
 * - isAuthenticated (토큰 기반, 동기적)만 사용
 * - loading 상태 없음 → "서버 연결 중" + 3초 타이머 reload 루프 제거
 * - 가구가 없으면 온보딩 페이지로 리디렉션
 */

import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdStore } from '../stores/useHouseholdStore'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
const CALLBACK_URL =
  typeof window !== 'undefined'
    ? import.meta.env.VITE_AUTH_CALLBACK_URL || `${window.location.origin}/auth/callback`
    : ''

/**
 * ProtectedRoute 컴포넌트
 * @returns 인증된 사용자면 자식 라우트를 렌더링하고, 아니면 podo-auth로 리다이렉트
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { households, isLoading } = useHouseholdStore()

  useEffect(() => {
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'intended_path',
        window.location.pathname + window.location.search
      )
      window.location.href = `${AUTH_URL}/login?redirect_uri=${encodeURIComponent(CALLBACK_URL)}`
    }
  }, [isAuthenticated])

  // 가구가 없으면 온보딩 페이지로 리디렉션
  useEffect(() => {
    if (isAuthenticated && !isLoading && households.length === 0 && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
  }, [isAuthenticated, isLoading, households.length, location.pathname, navigate])

  if (!isAuthenticated) return null

  return <Outlet />
}
