/**
 * 설정 페이지 E2E 테스트 (Tier 3)
 *
 * SettingsPage의 메뉴 항목 표시, 화면 모드 변경, 새소식,
 * 내 계정 정보, 로그아웃 플로우를 검증한다.
 */

import { test, expect } from '../fixtures/auth'

test.describe('설정 페이지', () => {
  test('설정 페이지 이동 → 메뉴 항목 표시 확인', async ({ authedPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // 주요 메뉴 항목이 모두 보여야 함
    const menuLabels = [
      '카테고리',
      '예산 관리',
      '반복 거래',
      '공유 가계부',
      '화면 모드',
      '내 계정',
      '새소식',
      '사용 가이드',
      '피드백',
    ]

    for (const label of menuLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 15000 })
    }
  })

  // TODO: 로컬 Playwright UI 모드에서 디버깅 필요 (#463)
  test.skip('화면 모드 섹션 → 테마 변경', async ({ authedPage: page }) => {
    await page.goto('/settings/appearance')
    await page.waitForLoadState('networkidle')

    // 화면 모드 헤딩이 보여야 함 (Suspense lazy loading 포함)
    await expect(page.getByText('화면 모드').first()).toBeVisible({ timeout: 15000 })

    // 3가지 테마 옵션이 보여야 함
    await expect(page.getByText('시스템 설정')).toBeVisible()
    await expect(page.getByText('라이트 모드')).toBeVisible()
    await expect(page.getByText('다크 모드')).toBeVisible()

    // 다크 모드 클릭 — 버튼으로 선택
    await page.locator('button').filter({ hasText: '다크 모드' }).click()
    // 다크 모드 옵션의 설명이 보여야 함
    await expect(page.getByText('어두운 화면')).toBeVisible()

    // 라이트 모드 클릭
    await page.locator('button').filter({ hasText: '라이트 모드' }).click()
    await expect(page.getByText('밝은 화면')).toBeVisible()

    // 시스템 설정 클릭
    await page.locator('button').filter({ hasText: '시스템 설정' }).click()
    await expect(page.getByText('기기 설정에 따라 자동 전환')).toBeVisible()
    // 시스템 모드에서는 현재 적용 모드 안내 텍스트가 보임
    await expect(page.getByText(/현재 적용:/).first()).toBeVisible()
  })

  test('새소식 섹션 → 버전 히스토리 표시', async ({ authedPage: page }) => {
    await page.goto('/settings/changelog')
    await page.waitForLoadState('networkidle')

    // 버전 번호 형식(vX.X.X)이 하나 이상 보여야 함
    await expect(page.locator('text=/v\\d+\\.\\d+/').first()).toBeVisible({ timeout: 15000 })
  })

  test('내 계정 섹션 → 이메일, 봇 연동 코드 발급 버튼 확인', async ({ authedPage: page }) => {
    await page.goto('/settings/my-account')
    await page.waitForLoadState('networkidle')

    // 기본 정보 영역
    await expect(page.getByText('기본 정보')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('이메일')).toBeVisible()

    // 텔레그램 연동 코드 발급 버튼 (미연동 상태에서 표시)
    // E2E 유저는 봇 미연동이므로 "연동 코드 발급" 버튼이 보임
    await expect(page.getByRole('button', { name: '연동 코드 발급' }).first()).toBeVisible()
  })

  test('로그아웃 버튼 클릭 → 로그인 페이지 이동', async ({ authedPage: page }) => {
    await page.goto('/settings/my-account')
    await page.waitForLoadState('networkidle')

    // 로그아웃 버튼이 보여야 함
    const logoutButton = page.getByRole('button', { name: '로그아웃' })
    await expect(logoutButton).toBeVisible({ timeout: 15000 })

    // 로그아웃 클릭
    await logoutButton.click()

    // SSO 로그인 페이지(auth.podonest.com) 또는 로컬 로그인 페이지로 이동
    await expect(page).toHaveURL(/auth\.podonest\.com|\/login/, { timeout: 15000 })
  })
})
