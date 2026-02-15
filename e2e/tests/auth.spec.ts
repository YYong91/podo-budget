import { test, expect } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000'

test.describe('인증 플로우', () => {
  const uniqueId = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  test('회원가입 후 대시보드로 이동', async ({ page }) => {
    await page.goto('/login')

    // 회원가입 탭 클릭 (탭 버튼 = first, 링크 버튼 = second)
    await page.getByRole('button', { name: '회원가입' }).first().click()

    const username = uniqueId()
    await page.getByPlaceholder('사용자명').fill(username)
    await page.getByPlaceholder('비밀번호').fill('TestPass123!')

    // 약관 동의 체크박스
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check()
    }

    // 제출 버튼 (form 내 submit 버튼)
    await page.locator('form').getByRole('button', { name: '회원가입' }).click()

    // 대시보드로 이동 확인
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })

  test('로그인 성공 → 대시보드 이동', async ({ page, request }) => {
    const username = uniqueId()
    const password = 'TestPass123!' // pragma: allowlist secret

    // API로 유저 생성
    await request.post(`${API_URL}/api/auth/register`, {
      data: { username, password },
    })

    await page.goto('/login')
    await page.getByPlaceholder('사용자명').fill(username)
    await page.getByPlaceholder('비밀번호').fill(password)

    // form 내 submit 버튼 클릭
    await page.locator('form').getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL('/', { timeout: 10000 })
    // 대시보드 제목 확인
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
  })

  test('잘못된 비밀번호 → 에러 메시지', async ({ page, request }) => {
    const username = uniqueId()

    await request.post(`${API_URL}/api/auth/register`, {
      data: { username, password: 'TestPass123!' }, // pragma: allowlist secret
    })

    await page.goto('/login')
    await page.getByPlaceholder('사용자명').fill(username)
    await page.getByPlaceholder('비밀번호').fill('WrongPass999!')

    // form 내 submit 버튼 클릭
    await page.locator('form').getByRole('button', { name: '로그인' }).click()

    // 에러 토스트 메시지 확인
    await expect(page.getByText(/실패|잘못|일치하지/)).toBeVisible({ timeout: 5000 })
  })

  test('미인증 접근 → 로그인 페이지 리다이렉트', async ({ page }) => {
    await page.goto('/expenses')
    await expect(page).toHaveURL('/login', { timeout: 5000 })
  })
})
