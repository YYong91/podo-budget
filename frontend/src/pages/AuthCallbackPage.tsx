/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 *
 * Safari ITP 문제: auth.podonest.com이 JS로 설정한 .podonest.com 쿠키를
 * budget.podonest.com에서 읽지 못하는 경우가 있음 (Chrome은 정상).
 *
 * 처리 방식:
 * - ?token= 있음: setTokenFromCallback()으로 AuthProvider 상태를 직접 업데이트
 *   → localStorage 저장 + React state 즉시 반영 → navigate()로 충분
 *   → (이전 방식) window.location.replace() 하드 리로드는 Safari bfcache 또는
 *     구 서비스 워커 캐시 문제로 이전 token=null 상태를 복원해 무한 루프 유발
 * - ?token= 없음: 쿠키가 읽히는 환경(Chrome 등) → navigate()로 충분
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { setTokenFromCallback } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')

    const intendedPath = sessionStorage.getItem('intended_path') || '/'
    sessionStorage.removeItem('intended_path')

    if (urlToken) {
      // AuthProvider 상태를 직접 업데이트 (localStorage 저장 + setToken)
      // → 하드 리로드 없이 isAuthenticated가 즉시 true로 전환됨
      setTokenFromCallback(urlToken)
    }

    navigate(intendedPath, { replace: true })
  }, [navigate, setTokenFromCallback])

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
        <p className="text-sm text-warm-500">로그인 처리 중...</p>
      </div>
    </div>
  )
}
