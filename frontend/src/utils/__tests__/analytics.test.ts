/**
 * @file analytics.test.ts
 * @description Google Analytics 4 래퍼 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initAnalytics, trackEvent, trackPageView, identifyUser } from '../analytics'

describe('analytics', () => {
  beforeEach(() => {
    // _initialized를 리셋하기 위해 모듈을 격리해서 테스트해야 하지만,
    // 모듈 상태 공유 문제를 피하기 위해 순서를 고려하여 테스트한다.
    vi.restoreAllMocks()
    // document.head의 script 태그 정리
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    // window 전역 정리
    delete (window as unknown as Record<string, unknown>).dataLayer
    delete (window as unknown as Record<string, unknown>).gtag
  })

  describe('initAnalytics', () => {
    it('VITE_GA_MEASUREMENT_ID 미설정 시 아무것도 하지 않는다', async () => {
      vi.stubEnv('VITE_GA_MEASUREMENT_ID', '')

      await initAnalytics()

      // script 태그가 삽입되지 않아야 한다
      const scripts = document.head.querySelectorAll('script')
      expect(scripts).toHaveLength(0)
      expect(window.dataLayer).toBeUndefined()
    })

    it('Measurement ID 설정 시 gtag.js 스크립트를 삽입하고 초기화한다', async () => {
      vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')

      await initAnalytics()

      // script 태그가 삽입되어야 한다
      const scripts = document.head.querySelectorAll('script')
      expect(scripts.length).toBeGreaterThanOrEqual(1)
      const gtagScript = Array.from(scripts).find((s) =>
        s.src.includes('googletagmanager.com/gtag/js?id=G-TEST123'),
      )
      expect(gtagScript).toBeDefined()
      expect(gtagScript!.async).toBe(true)

      // dataLayer가 초기화되어야 한다
      expect(window.dataLayer).toBeDefined()
      expect(Array.isArray(window.dataLayer)).toBe(true)

      // gtag 함수가 설정되어야 한다
      expect(typeof window.gtag).toBe('function')

      // gtag('js', ...) + gtag('config', ...) 호출로 dataLayer에 2개 항목이 있어야 한다
      expect(window.dataLayer!.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('trackEvent / trackPageView / identifyUser — 초기화 전', () => {
    it('초기화 전에는 trackEvent가 아무것도 하지 않는다', async () => {
      // 모듈 캐시를 리셋하여 _initialized = false인 새 인스턴스를 얻는다
      vi.resetModules()
      const mod = await import('../analytics')

      // 초기화하지 않은 상태에서 호출 — _initialized가 false이므로 early return
      expect(() => mod.trackEvent('test_event')).not.toThrow()
      expect(() => mod.trackPageView('/test')).not.toThrow()
      expect(() => mod.identifyUser('user123')).not.toThrow()
    })
  })

  describe('trackEvent / trackPageView / identifyUser — 초기화 후', () => {
    beforeEach(async () => {
      vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
      await initAnalytics()
      // 실제 gtag를 spy로 교체 (dataLayer.push를 추적)
      vi.spyOn(window, 'gtag')
    })

    it('trackEvent가 gtag("event", ...)를 호출한다', () => {
      trackEvent('purchase', { value: 100 })

      expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', { value: 100 })
    })

    it('trackEvent를 파라미터 없이 호출할 수 있다', () => {
      trackEvent('click')

      expect(window.gtag).toHaveBeenCalledWith('event', 'click', undefined)
    })

    it('trackPageView가 gtag("event", "page_view", ...)를 호출한다', () => {
      trackPageView('/dashboard')

      expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/dashboard',
      })
    })

    it('identifyUser가 gtag("set", { user_id })를 호출한다', () => {
      identifyUser('user-42')

      expect(window.gtag).toHaveBeenCalledWith('set', { user_id: 'user-42' })
    })
  })
})
