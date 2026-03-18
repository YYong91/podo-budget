/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트
 * - isAuthenticated (토큰 기반, 동기적) 판단
 * - 인증 후 initializeApp으로 households + invitations fetch
 * - hasInitialized 완료 전까지 로딩 UI 표시 (premature redirect 방지)
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

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { households, hasInitialized, initError, initializeApp } = useHouseholdStore()

  // 미인증 → SSO 로그인
  useEffect(() => {
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'intended_path',
        window.location.pathname + window.location.search
      )
      window.location.href = `${AUTH_URL}/login?redirect_uri=${encodeURIComponent(CALLBACK_URL)}`
    }
  }, [isAuthenticated])

  // 인증 후 앱 초기화 (households + invitations fetch)
  useEffect(() => {
    if (isAuthenticated) {
      initializeApp().catch(() => {})
    }
  }, [isAuthenticated, initializeApp])

  // 초기화 완료 + 가구 없음 → 온보딩 (단, 초대 수락 경로는 제외)
  useEffect(() => {
    if (
      isAuthenticated &&
      hasInitialized &&
      !initError &&
      households.length === 0 &&
      location.pathname !== '/onboarding' &&
      !location.pathname.startsWith('/invitations/accept')
    ) {
      navigate('/onboarding', { replace: true })
    }
  }, [isAuthenticated, hasInitialized, initError, households.length, location.pathname, navigate])

  if (!isAuthenticated) return null

  // 초기화 중 → 로딩 UI
  if (!hasInitialized) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center gap-3">
        <img src="/logo-transparent-192.png" alt="포도가계부" className="w-12 h-12" />
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-6 h-6" />
      </div>
    )
  }

  // 초기화 실패 → 재시도 UI
  if (initError) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center gap-4 p-4">
        <img src="/logo-transparent-192.png" alt="포도가계부" className="w-12 h-12" />
        <p className="text-sm text-[var(--text-tertiary)]">서버에 연결할 수 없습니다</p>
        <button
          onClick={() => {
            useHouseholdStore.setState({ hasInitialized: false, initError: null })
            initializeApp().catch(() => {})
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return <Outlet />
}
