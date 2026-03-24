/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트 (#337)
 *
 * Supabase Auth 전환:
 * - 미인증 시 /login 페이지로 (앱 내장, podo-auth 외부 리디렉션 제거)
 * - initializeApp으로 households + invitations fetch
 * - 가구가 없으면 온보딩 페이지로 리디렉션
 */

import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdStore } from '../stores/useHouseholdStore'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { households, hasInitialized, initError, initializeApp } = useHouseholdStore()

  // 로딩 중이면 대기
  // 미인증 → /login 리디렉션 (intended path 저장)
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'intended_path',
        window.location.pathname + window.location.search
      )
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  // 인증 후 앱 초기화 (households + invitations fetch)
  useEffect(() => {
    if (isAuthenticated) {
      initializeApp().catch(() => {})
    }
  }, [isAuthenticated, initializeApp])

  // 초기화 완료 + 가구 없음 → 온보딩
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

  // 로딩 중 또는 미인증
  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center gap-3">
        <img src="/logo-transparent-192.png" alt="포도가계부" className="w-12 h-12" />
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-6 h-6" />
      </div>
    )
  }

  // 초기화 중
  if (!hasInitialized) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center gap-3">
        <img src="/logo-transparent-192.png" alt="포도가계부" className="w-12 h-12" />
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-6 h-6" />
      </div>
    )
  }

  // 초기화 실패
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
