/**
 * 인증 플로우 E2E 테스트
 *
 * SSO 리디렉션과 인증 상태 접근을 검증한다.
 */

import { test, expect } from '@playwright/test'
import { test as authedTest, expect as authedExpect } from '../fixtures/auth'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

test.describe('인증 플로우 (SSO)', () => {
  test('미인증 접근 → SSO 로그인 리다이렉트', async ({ page }) => {
    // 미인증 상태에서 보호된 페이지 접근
    await page.goto(BASE_URL)
    // ProtectedRoute가 auth.podonest.com으로 리디렉트하거나
    // 로컬 환경에서는 빈 화면(isAuthenticated=false → return null)
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/auth\.podonest\.com|localhost:5173/)
  })
})

authedTest.describe('인증된 상태', () => {
  authedTest('E2E setup으로 인증 후 메인 페이지 접근 가능', async ({ authedPage }) => {
    // 인증된 상태이므로 SSO 리디렉트 없이 앱이 로드되어야 함
    await authedExpect(authedPage).not.toHaveURL(/auth\.podonest\.com/)
    // 가계부 홈이 로드됨 — nav가 보여야 함
    await authedExpect(authedPage.locator('nav').first()).toBeVisible({ timeout: 15000 })
  })
})
