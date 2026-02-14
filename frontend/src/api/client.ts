/* API 클라이언트 설정 */

import * as Sentry from '@sentry/react'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || '요청 처리 중 오류가 발생했습니다'
    console.error('API Error:', message)

    // 5xx 서버 에러 또는 네트워크 에러만 Sentry에 보고
    const status = error.response?.status
    if (!status || status >= 500) {
      Sentry.captureException(error)
    }

    return Promise.reject(error)
  }
)

export default apiClient
