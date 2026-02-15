import { test, expect } from '../fixtures/auth'

test.describe('지출 CRUD', () => {
  test('폼 모드로 지출 생성', async ({ authedPage: page }) => {
    await page.goto('/expenses/new')

    // 폼 입력 모드 전환
    await page.getByRole('button', { name: /폼/ }).click()

    await page.getByPlaceholder(/금액/).fill('15000')
    await page.getByPlaceholder(/설명|내용/).fill('E2E 테스트 점심')

    // 날짜는 기본값(오늘) 사용
    await page.getByRole('button', { name: /저장|등록/ }).click()

    // 성공 후 목록 또는 상세 페이지로 이동
    await expect(page).toHaveURL(/\/expenses/, { timeout: 10000 })
  })

  test('지출 목록 조회', async ({ authedPage: page }) => {
    await page.goto('/expenses')

    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: /지출/ })).toBeVisible()
  })

  test('지출 상세 보기', async ({ authedPage: page, request }) => {
    // API로 지출 생성
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const res = await request.post(
      `${process.env.E2E_API_URL || 'http://localhost:8000'}/api/expenses`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          amount: 8000,
          description: 'E2E 상세 테스트',
          date: new Date().toISOString().slice(0, 10),
        },
      },
    )
    const expense = await res.json()

    await page.goto(`/expenses/${expense.id}`)
    await expect(page.getByText('E2E 상세 테스트')).toBeVisible()
    await expect(page.getByText(/8,000|8000/)).toBeVisible()
  })

  test('지출 수정', async ({ authedPage: page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const res = await request.post(
      `${process.env.E2E_API_URL || 'http://localhost:8000'}/api/expenses`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          amount: 5000,
          description: 'E2E 수정 전',
          date: new Date().toISOString().slice(0, 10),
        },
      },
    )
    const expense = await res.json()

    await page.goto(`/expenses/${expense.id}`)

    // 수정 모드 진입
    await page.getByRole('button', { name: /수정|편집/ }).click()

    // 설명 필드 수정
    const descInput = page.locator('input[value="E2E 수정 전"], textarea').first()
    await descInput.clear()
    await descInput.fill('E2E 수정 후')

    await page.getByRole('button', { name: /저장/ }).click()

    // 수정된 내용 확인
    await expect(page.getByText('E2E 수정 후')).toBeVisible({ timeout: 5000 })
  })

  test('지출 삭제', async ({ authedPage: page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const res = await request.post(
      `${process.env.E2E_API_URL || 'http://localhost:8000'}/api/expenses`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          amount: 3000,
          description: 'E2E 삭제 대상',
          date: new Date().toISOString().slice(0, 10),
        },
      },
    )
    const expense = await res.json()

    await page.goto(`/expenses/${expense.id}`)

    // 삭제 버튼 클릭
    await page.getByRole('button', { name: /삭제/ }).click()

    // 확인 모달에서 확인
    await page.getByRole('button', { name: /확인|삭제/ }).last().click()

    // 목록 페이지로 이동
    await expect(page).toHaveURL(/\/expenses/, { timeout: 10000 })
  })
})
