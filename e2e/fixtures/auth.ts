/**
 * E2E 테스트 인증 fixture
 *
 * /api/e2e/setup → JWT 발급 → addInitScript로 페이지 로드 전 토큰 주입
 *
 * 핵심: page.addInitScript는 모든 page.goto 전에 실행되어
 * React가 마운트될 때 getCookieToken()이 토큰을 읽을 수 있음.
 * 이렇게 하면 SSO 리다이렉트가 발생하지 않음.
 */

import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

interface AuthFixtures {
  authedPage: Page
}

/** E2E setup 엔드포인트로 테스트 유저 생성 + JWT 발급 */
async function setupE2EUser(
  request: Page['request'],
): Promise<{ token: string; userId: number; householdId: number }> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const res = await request.post(`${API_URL}/api/e2e/setup`, {
    data: { username: `e2e_${suffix}`, email: `e2e_${suffix}@test.com` },
  })
  if (!res.ok()) {
    throw new Error(`E2E setup 실패: ${res.status()} ${await res.text()}`)
  }
  return res.json()
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    const { token } = await setupE2EUser(page.request)

    // addInitScript: 모든 page.goto/reload 전에 실행됨
    // React가 마운트되기 전에 localStorage + cookie에 토큰 주입
    await page.addInitScript((t) => {
      localStorage.setItem('podo_access_token', t)
      document.cookie = `podo_access_token=${t}; Path=/; SameSite=Lax`
    }, token)

    // 앱 로드 — React 초기화 시 getCookieToken()이 토큰을 읽어 isAuthenticated=true
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // 앱 초기화 완료 대기 (ProtectedRoute → initializeApp → Layout 렌더)
    try {
      await page.waitForSelector('nav', { timeout: 15000 })
    } catch {
      const url = page.url()
      const html = await page.content()
      throw new Error(
        `앱 초기화 실패 — nav 미발견\nURL: ${url}\nHTML: ${html.slice(0, 500)}`,
      )
    }

    await use(page)
  },
})

export { expect, API_URL, BASE_URL }

/**
 * API 요청용 토큰 추출 — localStorage에서 읽음
 */
export async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('podo_access_token'))
  if (!token) throw new Error('podo_access_token을 찾을 수 없습니다')
  return token
}
