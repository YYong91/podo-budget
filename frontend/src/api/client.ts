/* API 클라이언트 설정 */

import axios from 'axios'
import toast from 'react-hot-toast'
import { captureException } from '../utils/sentry'
import { getCookieToken } from '../utils/token'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000, // Fly.io 콜드 스타트 대기 시간 고려 (10s → 30s)
  headers: { 'Content-Type': 'application/json' },
})

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

// 409 Conflict 자동 재시도 (Fly.io 콜드 스타트 또는 동시 요청 레이스 컨디션)
const MAX_RETRIES = 2
const RETRY_DELAY = 1500

async function retryOn409(error: unknown): Promise<unknown> {
  const axiosError = error as import('axios').AxiosError
  const config = axiosError.config as import('axios').InternalAxiosRequestConfig & { _retryCount?: number }
  if (!config || axiosError.response?.status !== 409) return Promise.reject(error)

  config._retryCount = (config._retryCount ?? 0) + 1
  if (config._retryCount > MAX_RETRIES) return Promise.reject(error)

  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
  return apiClient.request(config)
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status

    // 409 Conflict → 자동 재시도
    if (status === 409) {
      return retryOn409(error)
    }

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
