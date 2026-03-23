/**
 * 뒤로가기 훅 — 진입 경로에 따라 일관된 네비게이션 (#332)
 *
 * 브라우저 히스토리가 있으면 뒤로가기(-1), 없으면 fallback 경로로 이동.
 * PWA에서 직접 URL 접근 시 히스토리가 없을 수 있으므로 fallback 필수.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useGoBack(fallback: string = '/') {
  const navigate = useNavigate()

  return useCallback(() => {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }, [navigate, fallback])
}
