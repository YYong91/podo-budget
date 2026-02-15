/**
 * Sentry 지연 로딩 래퍼
 * DSN이 설정된 경우에만 @sentry/react를 동적 import하여 번들 크기 절감
 */

type SentryModule = typeof import('@sentry/react')

let _sentry: SentryModule | null = null

/** Sentry 초기화 — DSN이 있을 때만 동적 로드 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  _sentry = await import('@sentry/react')
  _sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    integrations: [_sentry.browserTracingIntegration(), _sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

/** 에러 캡처 — Sentry 미로드 시 무시 */
export function captureException(error: unknown): void {
  _sentry?.captureException(error)
}

/** ErrorBoundary 컴포넌트 반환 — Sentry 미로드 시 null */
export function getErrorBoundary() {
  return _sentry?.ErrorBoundary ?? null
}
