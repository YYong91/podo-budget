/**
 * 핵심 플로우 E2E 테스트
 *
 * main 브랜치 PR (release/hotfix) 시 실행.
 * 프로덕션 배포 전 "화면이 실제로 동작하는가" 최종 검증.
 *
 * 이 파일은 playwright.config.ts의 testDir('./tests') 밖에 있어
 * 기본 실행에서 제외된다. 별도 `--config` 또는 직접 지정 시 사용.
 */
import { test, expect, API_URL } from './fixtures/auth'

test.describe('인증 플로우', () => {
  test('미인증 상태에서 SSO 리디렉션 또는 빈 화면', async ({ page }) => {
    await page.goto('/')
    // SSO 미인증 시 auth.podonest.com으로 리디렉션되거나 빈 화면
    await page.waitForTimeout(3000)
    await expect(page).not.toHaveURL(/\/expenses/)
  })

  test('JWT 쿠키로 인증 후 홈 접근', async ({ authedPage: page }) => {
    // authedPage fixture가 이미 인증 + 앱 초기화를 완료함
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('지출 입력 플로우', () => {
  test('자연어 입력 페이지 접근', async ({ authedPage: page }) => {
    await page.goto('/expenses/new')
    await page.waitForLoadState('networkidle')

    // 자연어 입력 필드 확인 (ExpenseForm의 기본 모드 = natural)
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 15000 })
  })
})

test.describe('페이지 네비게이션', () => {
  test('4탭 네비게이션 동작 확인', async ({ authedPage: page }) => {
    // 하단/사이드바 네비게이션 확인
    const nav = page.locator('nav')
    await expect(nav.first()).toBeVisible({ timeout: 15000 })

    // 각 탭 클릭 → 페이지 전환 확인
    // Layout navItems: 가계부(/), 자산(/assets), 돌아보기(/insights), 더보기(/settings)
    const tabs = [
      { label: '자산', path: '/assets' },
      { label: '돌아보기', path: '/insights' },
      { label: '더보기', path: '/settings' },
      { label: '가계부', path: '/' },
    ]
    for (const { label, path } of tabs) {
      await page.getByRole('link', { name: label }).first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(path)
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
