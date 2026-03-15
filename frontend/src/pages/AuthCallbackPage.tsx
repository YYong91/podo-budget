/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 *
 * Safari ITP 문제: auth.podonest.com이 JS로 설정한 .podonest.com 쿠키를
 * budget.podonest.com에서 읽지 못하는 경우가 있음 (Chrome은 정상).
 *
 * 처리 방식 (레이스 컨디션 방지):
 * - Effect 1 (mount): ?token= 있으면 setTokenFromCallback()으로 상태 업데이트 + localStorage 저장
 * - Effect 2 (isAuthenticated 감시): isAuthenticated가 true가 된 후에만 navigate()
 *   → setToken() 큐와 navigate() 사이의 레이스 컨디션을 완전히 제거
 *   → setToken()이 적용되기 전에 navigate()가 ProtectedRoute를 렌더링하면
 *     isAuthenticated=false로 auth 리다이렉트 → 무한 루프 발생 가능
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { setTokenFromCallback, isAuthenticated } = useAuth()

  // mount 시 1회만 읽기 (useState 초기화로 sessionStorage 사이드이펙트 처리)
  const [urlToken] = useState(() => new URLSearchParams(window.location.search).get('token'))
  const [intendedPath] = useState(() => {
    const path = sessionStorage.getItem('intended_path') || '/'
    sessionStorage.removeItem('intended_path')
    return path
  })

  // Effect 1: mount 시 토큰 설정 (urlToken이 없으면 쿠키 기반이므로 스킵)
  useEffect(() => {
    if (urlToken) {
      console.log('[podo-auth] AuthCallback Effect1: setTokenFromCallback 호출')
      setTokenFromCallback(urlToken)
    } else {
      console.log('[podo-auth] AuthCallback Effect1: urlToken 없음 (쿠키 기반 Chrome)')
    }
  }, [urlToken, setTokenFromCallback])

  // Effect 2: isAuthenticated가 true가 된 후 navigate
  // - urlToken 없음(Chrome): isAuthenticated가 이미 true → 즉시 navigate
  // - urlToken 있음(Safari): setTokenFromCallback 후 상태 업데이트 완료 → navigate
  useEffect(() => {
    console.log('[podo-auth] AuthCallback Effect2:', { urlToken: !!urlToken, isAuthenticated, intendedPath })
    if (!urlToken || isAuthenticated) {
      navigate(intendedPath, { replace: true })
    }
  }, [isAuthenticated, urlToken, intendedPath, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
        <p className="text-sm text-[var(--text-tertiary)]">로그인 처리 중...</p>
      </div>
    </div>
  )
}
