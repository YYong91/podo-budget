import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'

/** 테스트용 유저 생성 + 로그인하여 토큰 반환 */
async function createAndLogin(
  request: Page['request'],
  suffix: string,
): Promise<{ token: string; username: string }> {
  const username = `e2e_user_${suffix}_${Date.now()}`
  const password = 'TestPass123!' // pragma: allowlist secret

  // 회원가입
  await request.post(`${API_URL}/api/auth/register`, {
    data: { username, password },
  })

  // 로그인
  const loginRes = await request.post(`${API_URL}/api/auth/login`, {
    data: { username, password },
  })
  const body = await loginRes.json()
  return { token: body.access_token, username }
}

/** 로그인된 상태의 페이지를 제공하는 fixture */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    const { token } = await createAndLogin(page, 'main')

    // localStorage에 토큰 주입 (앱이 localStorage에서 토큰을 읽는 경우)
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
    await page.goto(baseURL)
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t)
    }, token)

    await page.goto(baseURL)
    await use(page)
  },
})

export { expect, API_URL }
