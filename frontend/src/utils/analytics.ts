/**
 * Google Analytics 4 래퍼
 * VITE_GA_MEASUREMENT_ID가 설정된 경우에만 gtag.js를 동적 로드하여 번들 크기 절감
 * Sentry 래퍼(utils/sentry.ts)와 동일한 패턴: 미설정 시 모든 함수가 no-op
 */

let _initialized = false

/** GA4 초기화 — Measurement ID가 있을 때만 gtag.js 로드 */
export async function initAnalytics(): Promise<void> {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
  if (!measurementId) return

  // gtag.js 스크립트 동적 삽입
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  // gtag 초기화
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    send_page_view: false, // 수동 page_view 전송 (SPA 라우팅 대응)
  })

  _initialized = true
}

/** 커스텀 이벤트 전송 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!_initialized) return
  window.gtag('event', eventName, params)
}

/** 페이지뷰 전송 (SPA 라우트 변경 시 호출) */
export function trackPageView(path: string): void {
  if (!_initialized) return
  window.gtag('event', 'page_view', { page_path: path })
}

/** 사용자 식별 (로그인 후 호출) */
export function identifyUser(userId: string): void {
  if (!_initialized) return
  window.gtag('set', { user_id: userId })
}

// gtag 타입 선언
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag: (...args: unknown[]) => void
  }
}
