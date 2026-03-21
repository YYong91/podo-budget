/**
 * E2E 테스트 인증 fixture
 *
 * /api/e2e/setup → JWT 발급 → addInitScript로 페이지 로드 전 토큰 주입
 *
 * 핵심: page.addInitScript는 모든 page.goto 전에 실행되어
 * React가 마운트될 때 getCookieToken()이 토큰을 읽을 수 있음.
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

    // 브라우저 콘솔 에러 수집 (디버깅용)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      consoleErrors.push(`PageError: ${err.message}`)
    })

    // addInitScript: 모든 page.goto/reload 전에 실행됨
    // React가 마운트되기 전에 localStorage + cookie에 토큰 주입
    await page.addInitScript((t) => {
      localStorage.setItem('podo_access_token', t)
      document.cookie = `podo_access_token=${t}; Path=/; SameSite=Lax`
    }, token)

    // 앱 로드
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    // React 렌더링 대기 — #root에 자식이 생길 때까지
    try {
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root')
          return root && root.children.length > 0
        },
        { timeout: 15000 },
      )
    } catch {
      const url = page.url()
      const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NO ROOT')
      throw new Error(
        `React 마운트 실패\nURL: ${url}\n#root: ${rootHtml.slice(0, 300)}\nConsole errors: ${consoleErrors.join(' | ') || 'none'}`,
      )
    }

    // ProtectedRoute initializeApp 완료 대기 — nav 또는 onboarding 또는 로딩 스피너 후 콘텐츠
    try {
      // nav가 보이면 앱 정상 로드, 온보딩이면 /onboarding으로 이동
      await page.waitForSelector('nav, [class*="onboarding"], main', { timeout: 15000 })
    } catch {
      const url = page.url()
      const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 500))
      throw new Error(
        `앱 초기화 실패 — 콘텐츠 미발견\nURL: ${url}\nBody: ${bodyHtml}\nConsole errors: ${consoleErrors.join(' | ') || 'none'}`,
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
