/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 * 쿠키 기반 SSO: podo-auth가 .podonest.com 쿠키를 이미 설정함
 * URL ?token= 파라미터 방식 제거됨
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // 쿠키 기반 SSO: 별도 토큰 처리 불필요
    const intendedPath = sessionStorage.getItem('intended_path') || '/'
    sessionStorage.removeItem('intended_path')
    navigate(intendedPath, { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
        <p className="text-sm text-warm-500">로그인 처리 중...</p>
      </div>
    </div>
  )
}
