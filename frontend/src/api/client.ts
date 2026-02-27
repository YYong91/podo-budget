/* API 클라이언트 설정 */

import axios from 'axios'
import { captureException } from '../utils/sentry'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000, // Fly.io 콜드 스타트 대기 시간 고려 (10s → 30s)
  headers: { 'Content-Type': 'application/json' },
})

function getCookieToken(): string | null {
  // 1. 쿠키 우선 (Chrome/Android 등)
  const match = document.cookie.match(/(?:^|; )podo_access_token=([^;]+)/)
  if (match) return match[1]
  // 2. localStorage 폴백 (iOS Safari ITP가 JS 쿠키를 삭제하는 경우)
  try {
    return localStorage.getItem('podo_access_token')
  } catch {
    return null
  }
}

// 요청 인터셉터: 쿠키에서 토큰을 읽어 Authorization 헤더에 자동 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = getCookieToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || '요청 처리 중 오류가 발생했습니다'
    console.error('API Error:', message)

    // 5xx 서버 에러 또는 네트워크 에러만 Sentry에 보고
    const status = error.response?.status
    if (!status || status >= 500) {
      captureException(error)
    }

    return Promise.reject(error)
  }
)

export default apiClient
