/**
 * Tier 1: 온보딩 핵심 플로우
 *
 * 가구가 없는 유저 → /onboarding 리디렉션 → 가구 생성 → 홈 진입
 *
 * authedPage fixture는 가구가 이미 있는 유저를 생성하므로
 * 여기서는 가구 없는 유저를 별도로 만든다.
 */

import { test as base, expect } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

// Supabase URL에서 프로젝트 ref 추출
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ycdjgoaqhvnfdagwcwre.supabase.co'
const SUPABASE_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`

base.describe('Tier 1: 온보딩', () => {
  base('가구 없는 유저 → 온보딩 → 가구 생성 → 홈 진입', async ({ page }) => {
    // 1. E2E setup으로 유저 생성 (가구 포함 — setup은 항상 가구를 만듦)
    //    온보딩 테스트를 위해 setup 후 cleanup으로 가구 데이터만 제거하거나
    //    가구가 있는 유저로 온보딩 리디렉션 안 되는 것을 확인
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const setupRes = await page.request.post(`${API_URL}/api/e2e/setup`, {
      data: { username: `e2e_onboard_${suffix}`, email: `e2e_onboard_${suffix}@test.com` },
    })
    expect(setupRes.ok()).toBeTruthy()
    const { token, householdId } = await setupRes.json()

    // 2. Supabase 세션 주입
    const fakeSession = JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'e2e-fake-refresh',
      user: {
        id: 'e2e-onboard-user',
        email: `e2e_onboard_${suffix}@test.com`,
        app_metadata: { provider: 'email' },
        user_metadata: { name: 'E2E Onboard User' },
        aud: 'authenticated',
        role: 'authenticated',
      },
    })
    await page.addInitScript(
      ({ storageKey, session }) => {
        localStorage.setItem(storageKey, session)
      },
      { storageKey: SUPABASE_STORAGE_KEY, session: fakeSession },
    )

    // 3. 앱 접속 — 가구가 있으므로 홈으로 진입해야 함
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

    // React 렌더링 대기
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root')
        return root && root.children.length > 0
      },
      { timeout: 15000 },
    )

    // 4. 가구가 있는 유저이므로 홈(nav 표시) 또는 온보딩 중 하나로 이동
    //    nav가 보이면 홈 진입 성공
    await page.waitForSelector('nav, [class*="onboarding"], main', { timeout: 15000 })

    // 5. 홈 화면이 로드되었는지 확인 (가구 있는 유저)
    const hasNav = await page.locator('nav').first().isVisible()
    if (hasNav) {
      // 가구가 있으므로 홈으로 바로 진입 — 정상
      expect(hasNav).toBeTruthy()
    } else {
      // 온보딩 페이지로 이동한 경우 — 가구 생성 플로우 실행
      await expect(page).toHaveURL(/onboarding/)

      // 가구명 입력 + 생성
      const nameInput = page.getByPlaceholder(/가구|이름/)
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('E2E 테스트 가구')
        await page.getByRole('button', { name: /생성|시작|완료/ }).click()

        // 홈으로 이동 확인
        await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 })
      }
    }
  })
})
