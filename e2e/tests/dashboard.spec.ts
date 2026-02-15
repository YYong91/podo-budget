import { test, expect } from '../fixtures/auth'

test.describe('대시보드', () => {
  test('빈 상태 → EmptyState 표시', async ({ authedPage: page }) => {
    await page.goto('/')

    // 빈 상태 메시지 또는 대시보드 제목
    await expect(
      page.getByText(/지출 기록이 없|대시보드/).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('지출 있을 때 → 통계 카드 표시', async ({ authedPage: page, request }) => {
    // API로 지출 생성
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000'

    await request.post(`${apiUrl}/api/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        amount: 25000,
        description: 'E2E 대시보드 테스트',
        date: new Date().toISOString().slice(0, 10),
      },
    })

    await page.goto('/')

    // 이번 달 총 지출 카드 확인
    await expect(page.getByText(/이번 달 총 지출/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/25,000|₩25/)).toBeVisible()
  })

  test('최근 지출 목록에 항목 표시', async ({ authedPage: page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000'

    await request.post(`${apiUrl}/api/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        amount: 12000,
        description: 'E2E 최근 지출 항목',
        date: new Date().toISOString().slice(0, 10),
      },
    })

    await page.goto('/')

    await expect(page.getByText('E2E 최근 지출 항목')).toBeVisible({ timeout: 10000 })
  })
})
