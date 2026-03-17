/* API 클라이언트 설정 */

import axios from 'axios'
import toast from 'react-hot-toast'
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
  // 2. localStorage 폴백 (Safari ITP로 쿠키 공유 불가 시)
  try { return localStorage.getItem('podo_access_token') } catch { return null }
}

// 요청 인터셉터: 쿠키/localStorage에서 토큰을 읽어 Authorization 헤더에 자동 추가
// 참고: AuthContext에도 동일 인터셉터가 등록되며 LIFO로 먼저 실행됨
//       AuthContext 인터셉터는 tokenRef(in-memory)를 우선 사용 → Safari Private 모드 대응
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
    const status = error.response?.status
    const message = error.response?.data?.detail || '요청 처리 중 오류가 발생했습니다'

    // 401은 AuthContext에서 처리 (SSO 리디렉션)
    // 나머지 에러는 글로벌 toast로 표시
    if (status !== 401) {
      const toastMsg = typeof message === 'string' ? message : '요청 처리 중 오류가 발생했습니다'
      toast.error(toastMsg)
    }

    // 5xx 서버 에러 또는 네트워크 에러만 Sentry에 보고
    if (!status || status >= 500) {
      captureException(error)
    }

    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

export default apiClient
