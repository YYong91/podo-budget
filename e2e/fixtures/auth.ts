/**
 * E2E 테스트 인증 fixture
 *
 * /api/e2e/setup 엔드포인트로 테스트 유저 생성 + JWT 발급 후
 * 쿠키 + localStorage에 토큰을 주입하여 인증 상태를 만든다.
 *
 * 앱 초기화(ProtectedRoute → initializeApp)가 완료될 때까지 대기하여
 * 안정적으로 테스트를 시작할 수 있게 한다.
 */

import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

interface AuthFixtures {
  authedPage: Page
  authToken: string
  householdId: number
}

/** E2E setup 엔드포인트로 테스트 유저 생성 + JWT 발급 */
async function setupE2EUser(
  request: Page['request'],
): Promise<{ token: string; userId: number; householdId: number }> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const username = `e2e_user_${suffix}`

  const res = await request.post(`${API_URL}/api/e2e/setup`, {
    data: { username, email: `${username}@test.com` },
  })

  if (!res.ok()) {
    throw new Error(`E2E setup 실패: ${res.status()} ${await res.text()}`)
  }

  const body = await res.json()
  return { token: body.token, userId: body.user_id, householdId: body.household_id }
}

/** 로그인된 상태의 페이지를 제공하는 fixture */
export const test = base.extend<AuthFixtures>({
  authToken: [async ({ page }, use) => {
    const { token } = await setupE2EUser(page.request)
    await use(token)
  }, { scope: 'test' }],

  householdId: [async ({ page }, use) => {
    const { householdId } = await setupE2EUser(page.request)
    await use(householdId)
  }, { scope: 'test' }],

  authedPage: async ({ page, context }, use) => {
    const { token } = await setupE2EUser(page.request)

    // 쿠키 주입 — url 기반 (localhost에서 domain 속성은 JS 접근 문제 발생 가능)
    await context.addCookies([
      {
        name: 'podo_access_token',
        value: token,
        url: BASE_URL,
      },
    ])

    // localStorage에도 저장 (앱의 getCookieToken은 쿠키 → localStorage 순서로 읽음)
    await page.goto(BASE_URL)
    await page.evaluate(
      (t) => {
        localStorage.setItem('podo_access_token', t)
      },
      token,
    )

    // 토큰이 설정된 상태에서 앱 로드
    await page.goto(BASE_URL)

    // ProtectedRoute → initializeApp 완료 대기
    // initializeApp이 끝나면 로딩 스피너가 사라지고 Layout의 nav가 렌더됨
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('nav', { timeout: 15000 })

    await use(page)
  },
})

export { expect, API_URL, BASE_URL }

/**
 * API 요청용 토큰 추출 헬퍼
 * context의 쿠키에서 podo_access_token을 읽어 반환한다.
 * 직접 API 호출 시 Authorization 헤더에 사용.
 */
export async function getAuthToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  const tokenCookie = cookies.find((c) => c.name === 'podo_access_token')
  if (!tokenCookie?.value) {
    throw new Error('podo_access_token 쿠키를 찾을 수 없습니다')
  }
  return tokenCookie.value
}
