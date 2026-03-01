/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 *
 * Safari ITP 문제: auth.podonest.com이 JS로 설정한 .podonest.com 쿠키를
 * budget.podonest.com에서 읽지 못하는 경우가 있음 (Chrome은 정상).
 *
 * 처리 방식:
 * - ?token= 있음: localStorage 저장 후 window.location.replace() (하드 리로드)
 *   → AuthProvider가 새로 마운트되어 localStorage 토큰을 읽어 정상 초기화
 *   → navigate()를 쓰면 AuthProvider 재마운트 없이 token=null 상태 유지 → 루프 발생
 * - ?token= 없음: 쿠키가 읽히는 환경(Chrome 등) → navigate()로 충분
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')

    const intendedPath = sessionStorage.getItem('intended_path') || '/'
    sessionStorage.removeItem('intended_path')

    if (urlToken) {
      try {
        localStorage.setItem('podo_access_token', urlToken)
      } catch {
        // private browsing 등 localStorage 접근 불가 시 무시
      }
      // 하드 리로드: AuthProvider가 새로 마운트되어 localStorage 토큰을 읽음
      // navigate()는 AuthProvider를 재마운트하지 않아 token=null 상태가 유지되므로 사용 불가
      window.location.replace(intendedPath)
      return
    }

    // 쿠키 기반 (Chrome 등): getCookieToken()이 동기적으로 쿠키를 찾으므로 navigate()로 충분
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
