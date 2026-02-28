/**
 * @file AuthCallbackPage.tsx
 * @description podo-auth SSO 콜백 페이지
 * 쿠키 기반 SSO + iOS Safari ITP 우회:
 * - 쿠키: 데스크톱/Android Chrome 등 사용
 * - localStorage: iOS Safari ITP가 JS 쿠키를 삭제하는 경우 폴백
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // iOS Safari ITP 우회: URL ?token= → localStorage 저장
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
      // localStorage 저장 후 하드 리다이렉트:
      // client-side navigate()를 쓰면 이미 마운트된 AuthContext가 initAuth()를
      // 재실행하지 않아 user=null로 남아 무한 리다이렉트 루프 발생 (모바일 Safari).
      // window.location.replace()로 풀 페이지 로드를 강제해 AuthContext가
      // localStorage 토큰을 읽어 정상 초기화되도록 한다.
      window.location.replace(intendedPath)
      return
    }

    // 쿠키 기반 (데스크톱/Android): client-side navigate로 충분
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
