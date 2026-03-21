import { test, expect } from '@playwright/test'
import { test as authedTest } from '../fixtures/auth'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

test.describe('인증 플로우 (SSO)', () => {
  test('미인증 접근 → SSO 로그인 리다이렉트', async ({ page }) => {
    await page.goto(`${BASE_URL}/expenses`)
    // podo-auth SSO로 리다이렉트되어야 함
    await expect(page).toHaveURL(/auth\.podonest\.com|\/auth\/callback/, { timeout: 10000 })
  })
})

authedTest.describe('인증된 상태', () => {
  authedTest('E2E setup으로 인증 후 메인 페이지 접근 가능', async ({ authedPage }) => {
    // 인증된 상태이므로 SSO 리다이렉트 없이 앱이 로드되어야 함
    await expect(authedPage).not.toHaveURL(/auth\.podonest\.com/)
    // 앱 내 콘텐츠가 보여야 함
    await expect(authedPage.locator('body')).not.toBeEmpty()
  })
})
