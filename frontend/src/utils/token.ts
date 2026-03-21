/** 쿠키/localStorage에서 podo_access_token을 읽는 공유 유틸 (#171) */

/**
 * podo_access_token 읽기 우선순위:
 * 1. 쿠키 (Chrome/Android 등)
 * 2. localStorage 폴백 (iOS Safari ITP로 쿠키 공유 불가 시)
 */
export function getCookieToken(): string | null {
  const match = document.cookie.match(/(?:^|; )podo_access_token=([^;]+)/)
  if (match) return match[1]
  try {
    return localStorage.getItem('podo_access_token')
  } catch {
    return null
  }
}
