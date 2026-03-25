/**
 * @file sentry.test.ts
 * @description Sentry 지연 로딩 래퍼 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// @sentry/react 모킹
const mockInit = vi.fn()
const mockCaptureException = vi.fn()
const mockBrowserTracingIntegration = vi.fn().mockReturnValue('browserTracing')
const mockReplayIntegration = vi.fn().mockReturnValue('replay')
const MockErrorBoundary = () => null
MockErrorBoundary.displayName = 'SentryErrorBoundary'

vi.mock('@sentry/react', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  browserTracingIntegration: mockBrowserTracingIntegration,
  replayIntegration: mockReplayIntegration,
  ErrorBoundary: MockErrorBoundary,
}))

describe('sentry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    mockInit.mockClear()
    mockCaptureException.mockClear()
  })

  describe('initSentry', () => {
    it('VITE_SENTRY_DSN 미설정 시 초기화하지 않는다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const { initSentry } = await import('../sentry')
      await initSentry()

      expect(mockInit).not.toHaveBeenCalled()
    })

    it('DSN 설정 시 Sentry.init을 호출한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123')
      vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'test')

      const { initSentry } = await import('../sentry')
      await initSentry()

      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'test',
          integrations: ['browserTracing', 'replay'],
          replaysOnErrorSampleRate: 1.0,
        }),
      )
    })

    it('환경 미설정 시 development로 기본값을 사용한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123')
      vi.stubEnv('VITE_SENTRY_ENVIRONMENT', '')

      const { initSentry } = await import('../sentry')
      await initSentry()

      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'development',
        }),
      )
    })
  })

  describe('captureException', () => {
    it('Sentry 미로드 시 에러 없이 무시한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const { initSentry, captureException } = await import('../sentry')
      await initSentry()

      // captureException 호출 — 에러 없이 no-op
      expect(() => captureException(new Error('test'))).not.toThrow()
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('Sentry 로드 후 captureException을 호출한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123')

      const { initSentry, captureException } = await import('../sentry')
      await initSentry()

      const error = new Error('테스트 에러')
      captureException(error)

      expect(mockCaptureException).toHaveBeenCalledWith(error)
    })
  })

  describe('getErrorBoundary', () => {
    it('Sentry 미로드 시 null을 반환한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', '')

      const { initSentry, getErrorBoundary } = await import('../sentry')
      await initSentry()

      expect(getErrorBoundary()).toBeNull()
    })

    it('Sentry 로드 후 ErrorBoundary 컴포넌트를 반환한다', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123')

      const { initSentry, getErrorBoundary } = await import('../sentry')
      await initSentry()

      const EB = getErrorBoundary()
      expect(EB).toBe(MockErrorBoundary)
    })
  })
})
