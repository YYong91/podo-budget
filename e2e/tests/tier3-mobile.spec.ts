/**
 * 모바일 뷰포트 E2E 테스트 (Tier 3)
 *
 * 375x812(iPhone X 기준) 뷰포트에서 하단 탭 네비게이션,
 * 탭 이동, FAB(지출/수입 입력 버튼)를 검증한다.
 */

import { test, expect } from '../fixtures/auth'

test.describe('모바일 뷰포트', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 812 })
  })

  test('하단 탭 네비게이션 표시 확인', async ({ authedPage: page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 모바일에서는 하단 탭 바(aria-label="하단 탭 메뉴")가 표시됨
    const bottomNav = page.locator('nav[aria-label="하단 탭 메뉴"]')
    await expect(bottomNav).toBeVisible({ timeout: 15000 })

    // 하단 탭 바에 4개 탭이 모두 존재하는지 확인
    for (const label of ['가계부', '자산', '돌아보기', '더보기']) {
      await expect(bottomNav.getByText(label)).toBeVisible()
    }
  })

  test('홈 → 돌아보기 → 자산 → 더보기 탭 이동', async ({ authedPage: page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const bottomNav = page.locator('nav[aria-label="하단 탭 메뉴"]')
    await expect(bottomNav).toBeVisible({ timeout: 15000 })

    // 돌아보기 탭
    await bottomNav.getByText('돌아보기').click()
    await expect(page).toHaveURL('/insights')

    // 자산 탭
    await bottomNav.getByText('자산').click()
    await expect(page).toHaveURL('/assets')

    // 더보기(설정) 탭
    await bottomNav.getByText('더보기').click()
    await expect(page).toHaveURL('/settings')

    // 가계부(홈) 탭으로 복귀
    await bottomNav.getByText('가계부').click()
    await expect(page).toHaveURL('/')
  })

  // TODO: 로컬 Playwright UI 모드에서 디버깅 필요 (#463)
  test.skip('FAB 클릭 → 지출 입력 페이지 이동', async ({ authedPage: page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 페이지 로딩 완료 대기 — 하단 탭 바 확인
    const bottomNav = page.locator('nav[aria-label="하단 탭 메뉴"]')
    await expect(bottomNav).toBeVisible({ timeout: 15000 })

    // FAB 메인 버튼 클릭 (aria-label="지출/수입 입력" when closed)
    // FloatingActionButton은 fixed position으로 항상 표시됨
    const fab = page.locator('button[aria-label="지출/수입 입력"]')
    await expect(fab).toBeVisible({ timeout: 15000 })
    await fab.click()

    // 팝오버에서 "지출 입력" 선택 — span 텍스트
    const expenseButton = page.locator('button').filter({ hasText: '지출 입력' })
    await expect(expenseButton).toBeVisible({ timeout: 5000 })
    await expenseButton.click()

    // 지출 입력 페이지로 이동
    await expect(page).toHaveURL('/expenses/new', { timeout: 15000 })
  })
})
