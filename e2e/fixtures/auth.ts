import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

/** E2E setup 엔드포인트로 테스트 유저 생성 + JWT 발급 */
async function setupE2EUser(
  request: Page['request'],
  suffix: string,
): Promise<{ token: string; userId: number; householdId: number }> {
  const username = `e2e_user_${suffix}_${Date.now()}`

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
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page, context }, use) => {
    const { token } = await setupE2EUser(page.request, 'main')

    // podo_access_token 쿠키에 토큰 주입 (podo-auth SSO 방식)
    await context.addCookies([
      {
        name: 'podo_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(BASE_URL)
    await use(page)
  },
})

export { expect, API_URL }
