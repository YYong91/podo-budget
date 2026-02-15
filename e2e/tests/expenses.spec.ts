import { test, expect } from '../fixtures/auth'

/** API로 지출 생성하는 헬퍼 */
async function createExpense(
  page: import('@playwright/test').Page,
  data: { amount: number; description: string },
) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000'

  const res = await page.request.post(`${apiUrl}/api/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...data,
      // asyncpg는 TIMESTAMP WITHOUT TIME ZONE에 timezone-aware datetime 거부
      // Z 제거하여 timezone-naive datetime 문자열로 전송
      date: new Date().toISOString().replace('Z', ''),
    },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`지출 생성 API 실패 (${res.status()}): ${body}`)
  }
  return res.json()
}

test.describe('지출 CRUD', () => {
  test('직접 입력 모드로 지출 생성', async ({ authedPage: page }) => {
    await page.goto('/expenses/new')

    // 직접 입력 모드 전환
    await page.getByRole('button', { name: /직접 입력/ }).click()

    await page.getByPlaceholder('10000').fill('15000')
    await page.getByPlaceholder('김치찌개').fill('E2E 테스트 점심')

    // 날짜는 기본값(오늘) 사용
    await page.getByRole('button', { name: /저장하기/ }).click()

    // 성공 후 목록 또는 상세 페이지로 이동
    await expect(page).toHaveURL(/\/expenses/, { timeout: 10000 })
  })

  test('지출 목록 조회', async ({ authedPage: page }) => {
    await page.goto('/expenses')

    // 페이지 제목 확인 (사이드바에도 "지출"이 있으므로 first)
    await expect(page.getByRole('heading', { name: /지출/ }).first()).toBeVisible()
  })

  test('지출 상세 보기', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 8000,
      description: 'E2E 상세 테스트',
    })

    await page.goto(`/expenses/${expense.id}`)
    await expect(page.getByText('E2E 상세 테스트')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/8,000|₩8/)).toBeVisible()
  })

  test('지출 수정', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 5000,
      description: 'E2E 수정 전',
    })

    await page.goto(`/expenses/${expense.id}`)

    // 상세 페이지 로딩 대기
    await expect(page.getByText('E2E 수정 전')).toBeVisible({ timeout: 10000 })

    // 수정 모드 진입
    await page.getByRole('button', { name: '수정' }).click()

    // 설명 필드 수정 (fill은 기존 값을 자동으로 지움)
    const descInput = page.getByPlaceholder('김치찌개')
    await expect(descInput).toBeVisible()
    await descInput.fill('E2E 수정 후')

    // PUT 요청 완료를 기다리며 저장
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/expenses/') && res.request().method() === 'PUT'),
      page.getByRole('button', { name: '저장' }).click(),
    ])

    // PUT 실패 시 디버깅을 위해 응답 상세 출력
    if (!response.ok()) {
      const body = await response.text()
      console.error(`PUT 실패 (${response.status()}): ${body}`)
      console.error(`요청 URL: ${response.url()}`)
      const reqBody = response.request().postData()
      console.error(`요청 본문: ${reqBody}`)
    }
    expect(response.ok()).toBeTruthy()

    // 수정된 내용 확인
    await expect(page.getByText('E2E 수정 후')).toBeVisible({ timeout: 10000 })
  })

  test('지출 삭제', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 3000,
      description: 'E2E 삭제 대상',
    })

    await page.goto(`/expenses/${expense.id}`)

    // 삭제 버튼 클릭
    await page.getByRole('button', { name: '삭제' }).first().click()

    // 확인 모달에서 삭제 클릭
    await page.getByRole('button', { name: '삭제' }).last().click()

    // 목록 페이지로 이동
    await expect(page).toHaveURL(/\/expenses/, { timeout: 10000 })
  })
})
