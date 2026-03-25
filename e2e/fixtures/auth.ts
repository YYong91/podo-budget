/**
 * E2E 테스트 인증 fixture — Supabase Auth 대응
 *
 * /api/e2e/setup → JWT 발급 → Supabase 세션 스토리지에 주입
 *
 * Supabase JS는 localStorage의 `sb-{ref}-auth-token`에서 세션을 읽으므로
 * 여기에 가짜 세션을 설정하면 AuthContext가 인증된 것으로 인식한다.
 */

import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

// Supabase URL에서 프로젝트 ref 추출 (sb-{ref}-auth-token 키 생성용)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ycdjgoaqhvnfdagwcwre.supabase.co'
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`

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

/** E2E 토큰을 Supabase 세션 형태로 변환 */
function buildFakeSupabaseSession(token: string, email: string) {
  // Supabase JS가 인식하는 최소 세션 구조
  return JSON.stringify({
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-fake-refresh-token',
    user: {
      id: 'e2e-fake-user-id',
      email,
      app_metadata: { provider: 'email' },
      user_metadata: { name: 'E2E Test User' },
      aud: 'authenticated',
      role: 'authenticated',
    },
  })
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
    // Supabase 세션 스토리지에 가짜 세션 주입
    const fakeSession = buildFakeSupabaseSession(token, 'e2e@test.com')
    await page.addInitScript(
      ({ storageKey, session }) => {
        localStorage.setItem(storageKey, session)
      },
      { storageKey: SUPABASE_STORAGE_KEY, session: fakeSession },
    )

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

    // ProtectedRoute 완료 대기 — nav 또는 onboarding 또는 main
    try {
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
 * API 요청용 토큰 추출 — Supabase 세션 스토리지에서 읽음
 */
export async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(
    (key) => {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw).access_token
      } catch {
        return null
      }
    },
    SUPABASE_STORAGE_KEY,
  )
  if (!token) throw new Error('Supabase 세션 토큰을 찾을 수 없습니다')
  return token
}
