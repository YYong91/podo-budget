/**
 * 네비게이션 E2E 테스트
 *
 * 4탭 네비게이션(가계부/자산/돌아보기/더보기)과 404 페이지를 검증한다.
 * Layout.tsx의 navItems 기반:
 *   - '/home' → 가계부 (Receipt)
 *   - '/assets' → 자산 (Landmark)
 *   - '/insights' → 돌아보기 (TrendingUp)
 *   - '/settings' → 더보기 (Settings)
 */

import { test, expect } from '../fixtures/auth'

test.describe('네비게이션', () => {
  test('사이드바 4탭 메뉴로 각 페이지 이동', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 사이드바/하단탭에 4개 네비게이션 항목이 있어야 함
    await expect(page.getByText('가계부').first()).toBeVisible({ timeout: 15000 })

    // 자산 탭
    await page.getByRole('link', { name: '자산' }).first().click()
    await expect(page).toHaveURL('/assets')

    // 돌아보기 탭
    await page.getByRole('link', { name: '돌아보기' }).first().click()
    await expect(page).toHaveURL('/insights')

    // 더보기 탭
    await page.getByRole('link', { name: '더보기' }).first().click()
    await expect(page).toHaveURL('/settings')

    // 가계부 탭으로 복귀
    await page.getByRole('link', { name: '가계부' }).first().click()
    await expect(page).toHaveURL('/home')
  })

  test('404 페이지 표시', async ({ authedPage: page }) => {
    await page.goto('/nonexistent-page-12345')
    await page.waitForLoadState('networkidle')

    // NotFoundPage: "404" + "페이지를 찾을 수 없습니다"
    await expect(page.getByText('404')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible()
  })

  test('모바일 뷰포트에서 하단 탭 바 표시', async ({ authedPage: page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 모바일에서는 하단 탭 바(aria-label="하단 탭 메뉴")가 표시됨
    const bottomNav = page.locator('nav[aria-label="하단 탭 메뉴"]')
    await expect(bottomNav).toBeVisible({ timeout: 15000 })

    // 하단 탭 바에 4개 탭이 모두 존재하는지 확인
    for (const label of ['가계부', '자산', '돌아보기', '더보기']) {
      await expect(bottomNav.getByText(label)).toBeVisible()
    }
  })
})
