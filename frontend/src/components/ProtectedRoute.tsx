/**
 * @file ProtectedRoute.tsx
 * @description 인증이 필요한 라우트를 보호하는 컴포넌트
 * 로그인하지 않은 사용자는 /login 페이지로 리다이렉트한다.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute 컴포넌트
 * @returns 인증된 사용자면 자식 라우트를 렌더링하고, 아니면 로그인 페이지로 리다이렉트
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  // 로딩 중일 때는 스피너 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 인증된 사용자는 자식 라우트 렌더링
  return <Outlet />
}
