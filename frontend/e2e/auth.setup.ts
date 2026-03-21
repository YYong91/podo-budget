/**
 * E2E 테스트 인증 헬퍼
 *
 * podo-auth SSO를 우회하여 테스트용 JWT를 직접 생성합니다.
 * BE /api/e2e/setup 엔드포인트로 JWT를 발급받아 쿠키에 주입합니다.
 */
import { Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'

/**
 * 테스트 유저 생성 + JWT 토큰 발급을 BE API로 처리
 * BE에 /api/e2e/setup 엔드포인트가 필요 (E2E 전용, DEBUG 모드에서만 활성화)
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // BE의 E2E 셋업 엔드포인트 호출 → 테스트 유저 + JWT 반환
  const response = await page.request.post(`${API_URL}/api/e2e/setup`, {
    data: { username: 'e2e-test-user', email: 'e2e@test.com' },
  })

  if (!response.ok()) {
    throw new Error(`E2E 셋업 실패: ${response.status()} ${await response.text()}`)
  }

  const { token } = await response.json()

  // 쿠키에 JWT 주입 (podo-auth SSO와 동일한 쿠키명)
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
  const url = new URL(baseURL)

  await page.context().addCookies([
    {
      name: 'podo_access_token',
      value: token,
      domain: url.hostname,
      path: '/',
    },
  ])

  // localStorage에도 저장 (Safari 호환 — AuthContext fallback)
  await page.goto(baseURL)
  await page.evaluate((t) => localStorage.setItem('podo_access_token', t), token)
}
