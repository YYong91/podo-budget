/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 * 쿠키 기반 SSO + iOS Safari ITP 우회:
 * - 쿠키: 데스크톱/Android Chrome 등 사용
 * - localStorage: iOS Safari ITP가 JS 쿠키를 삭제하는 경우 폴백
 *
 * 중요: navigate() 대신 window.location.replace()를 사용하여
 * 전체 앱을 재초기화한다. AuthProvider의 initAuth가 새 토큰으로
 * 다시 실행되어야 user 상태가 올바르게 설정된다.
 */

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  useEffect(() => {
    // iOS Safari ITP 우회: URL ?token= → localStorage 저장
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      try {
        localStorage.setItem('podo_access_token', urlToken)
      } catch {
        // private browsing 등 localStorage 접근 불가 시 무시
      }
    }

    // 리다이렉트 루프 쿨다운 해제 — 정상 콜백이므로 새 세션으로 간주
    try { sessionStorage.removeItem('last_auth_redirect') } catch { /* 무시 */ }

    const intendedPath = sessionStorage.getItem('intended_path') || '/'
    sessionStorage.removeItem('intended_path')

    // window.location.replace로 전체 앱 재초기화
    // → AuthProvider가 새 토큰으로 initAuth를 다시 실행
    window.location.replace(intendedPath)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-10 h-10 text-grape-600" />
        <p className="text-sm text-warm-500">로그인 처리 중...</p>
      </div>
    </div>
  )
}
