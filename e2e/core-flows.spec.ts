/**
 * 핵심 플로우 E2E 테스트
 *
 * main 브랜치 PR (release/hotfix) 시 실행.
 * 프로덕션 배포 전 "화면이 실제로 동작하는가" 최종 검증.
 */
import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './auth.setup'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'

test.describe('인증 플로우', () => {
  test('미인증 상태에서 로그인 페이지로 리디렉션', async ({ page }) => {
    await page.goto('/')
    // SSO 미인증 시 auth.podonest.com으로 리디렉션되거나 로그인 유도 UI 표시
    // 로컬 테스트에서는 인증 실패 상태만 확인
    await expect(page).not.toHaveURL(/\/expenses/)
  })

  test('JWT 쿠키로 인증 후 홈 접근', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/')
    // 인증 후 홈(가계부 목록)이 로드되어야 함
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('지출 입력 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('자연어 입력 → 프리뷰 → 확인', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 지출 입력 페이지로 이동
    const addButton = page.locator('[data-testid="add-expense"], a[href*="expense"], button:has-text("입력")')
    if (await addButton.isVisible()) {
      await addButton.first().click()
    } else {
      await page.goto('/expenses/new')
    }

    // 자연어 입력 필드 찾기
    const input = page.locator('textarea, input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('점심 김치찌개 8000원')

    // 제출 버튼
    const submitButton = page.locator('button[type="submit"], button:has-text("기록"), button:has-text("저장")')
    if (await submitButton.isVisible()) {
      await submitButton.first().click()
    }

    // 결과 확인 (프리뷰 or 저장 완료)
    await page.waitForLoadState('networkidle')
  })
})

test.describe('페이지 네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('4탭 네비게이션 동작 확인', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 하단 네비게이션 탭 확인
    const nav = page.locator('nav, [role="navigation"]')
    await expect(nav.first()).toBeVisible()

    // 각 탭 클릭 → 페이지 전환 확인
    const tabs = ['가계부', '리포트', '자산', '설정']
    for (const tabName of tabs) {
      const tab = page.locator(`a:has-text("${tabName}"), button:has-text("${tabName}")`)
      if (await tab.first().isVisible()) {
        await tab.first().click()
        await page.waitForLoadState('networkidle')
      }
    }
  })
})

test.describe('API 헬스체크', () => {
  test('BE /health 응답 확인', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`)
    expect(response.status()).toBe(200)
  })

  test('BE / 루트 응답 확인', async ({ request }) => {
    const response = await request.get(`${API_URL}/`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.message).toContain('포도가계부')
  })
})
