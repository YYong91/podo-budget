import { test, expect } from '../fixtures/auth'

test.describe('네비게이션', () => {
  test('사이드바 메뉴로 각 페이지 이동', async ({ authedPage: page }) => {
    await page.goto('/')

    // 지출 메뉴
    await page.getByRole('link', { name: /지출/ }).first().click()
    await expect(page).toHaveURL('/expenses')

    // 카테고리 메뉴
    await page.getByRole('link', { name: /카테고리/ }).click()
    await expect(page).toHaveURL('/categories')

    // 예산 메뉴
    await page.getByRole('link', { name: /예산/ }).click()
    await expect(page).toHaveURL('/budgets')

    // 대시보드로 복귀
    await page.getByRole('link', { name: /대시보드|홈/ }).first().click()
    await expect(page).toHaveURL('/')
  })

  test('404 페이지 표시', async ({ authedPage: page }) => {
    await page.goto('/nonexistent-page-12345')

    await expect(page.getByText(/404|찾을 수 없|존재하지 않/).first()).toBeVisible({ timeout: 10000 })
  })

  test('모바일 뷰포트에서 사이드바 토글', async ({ authedPage: page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    // 모바일에서 메뉴 버튼 클릭
    const menuButton = page.getByRole('button', { name: /메뉴/ }).or(
      page.locator('[aria-label="메뉴"]').or(page.locator('button').filter({ has: page.locator('svg') }).first()),
    )

    // 메뉴 버튼이 있으면 클릭하여 사이드바 열기
    if (await menuButton.first().isVisible()) {
      await menuButton.first().click()
      // 사이드바의 네비게이션 링크가 보이는지 확인
      await expect(page.getByRole('link', { name: /지출/ }).first()).toBeVisible({ timeout: 3000 })
    }
  })
})
