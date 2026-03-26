/**
 * Tier 2 예산 E2E 테스트
 *
 * API로 카테고리를 생성한 뒤 예산 설정 페이지에서 카테고리별 예산을 입력하고,
 * 지출 등록 후 예산 달성률 표시를 검증한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 카테고리 생성 헬퍼 */
async function createCategory(
  page: Page,
  data: { name: string; type?: string },
) {
  const token = await getAuthToken(page)
  const res = await page.request.post(`${API_URL}/api/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: data.name, type: data.type ?? 'expense' },
  })
  if (!res.ok()) {
    throw new Error(`카테고리 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

/** API로 예산 생성 헬퍼 */
async function createBudget(
  page: Page,
  data: { category_id: number; amount: number },
) {
  const token = await getAuthToken(page)
  const res = await page.request.post(`${API_URL}/api/budgets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      category_id: data.category_id,
      amount: data.amount,
      period: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
    },
  })
  if (!res.ok()) {
    throw new Error(`예산 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

/** API로 지출 생성 헬퍼 */
async function createExpense(
  page: Page,
  data: { amount: number; description: string; category_id?: number },
) {
  const token = await getAuthToken(page)
  const res = await page.request.post(`${API_URL}/api/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      amount: data.amount,
      description: data.description,
      category_id: data.category_id,
      date: new Date().toISOString().replace('Z', ''),
    },
  })
  if (!res.ok()) {
    throw new Error(`지출 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

test.describe('예산 관리', () => {
  test('카테고리별 예산 입력 → 저장 → 표시 확인', async ({ authedPage: page }) => {
    // 카테고리 생성
    const category = await createCategory(page, { name: 'E2E식비' })

    // 예산 관리 페이지로 이동
    await page.goto('/budgets')
    await page.waitForLoadState('networkidle')

    // 카테고리별 예산 섹션에서 'E2E식비' 카테고리 확인
    await expect(page.getByText('E2E식비')).toBeVisible({ timeout: 15000 })

    // 해당 카테고리의 예산 입력 필드에 금액 입력 (aria-label="${카테고리명} 예산")
    const budgetInput = page.getByLabel('E2E식비 예산')
    await expect(budgetInput).toBeVisible({ timeout: 10000 })
    await budgetInput.fill('300000')

    // dirty 상태 → "저장" 버튼이 나타남 → 클릭 + API 응답 대기
    const saveBtn = page.getByRole('button', { name: '저장' }).first()
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/budgets') && res.status() < 400,
        { timeout: 15000 },
      ),
      saveBtn.click(),
    ])

    // 저장 성공 → loadData() → dirty 해제 → 저장 버튼 사라짐
    await page.waitForTimeout(2000) // loadData 완료 대기

    // 페이지 새로고침 후에도 금액이 유지됨
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('E2E식비 예산')).toHaveValue('300000', { timeout: 15000 })
  })

  test('지출 등록 후 예산 달성률 표시', async ({ authedPage: page }) => {
    // 카테고리 + 예산 + 지출 생성 (API)
    const category = await createCategory(page, { name: 'E2E교통비' })
    await createBudget(page, { category_id: category.id, amount: 100000 })
    await createExpense(page, {
      amount: 45000,
      description: 'E2E 택시비',
      category_id: category.id,
    })

    // 예산 관리 페이지로 이동
    await page.goto('/budgets')
    await page.waitForLoadState('networkidle')

    // '예산 상황' 섹션에 카테고리 표시
    await expect(page.getByText('예산 상황')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E교통비')).toBeVisible()

    // 달성률 퍼센트 표시 확인 (45,000 / 100,000 = 45.0%)
    await expect(page.getByText('45.0%')).toBeVisible()

    // 사용 금액 표시 확인
    await expect(page.getByText(/45,000/).first()).toBeVisible()
  })

  test('월 총 예산 설정 → 저장', async ({ authedPage: page }) => {
    await page.goto('/budgets')
    await page.waitForLoadState('networkidle')

    // 월 총 예산 섹션 확인
    await expect(page.getByText('월 총 예산')).toBeVisible({ timeout: 15000 })

    // 총 예산 입력
    const totalInput = page.getByLabel('월 총 예산')
    await expect(totalInput).toBeVisible({ timeout: 10000 })
    await totalInput.fill('2000000')

    // dirty 상태 → "저장" 버튼 나타남 → 클릭 + API 응답 대기
    const saveBtn = page.getByRole('button', { name: '저장' }).first()
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/budgets') && res.status() < 400,
        { timeout: 15000 },
      ),
      saveBtn.click(),
    ])

    // 저장 완료 대기
    await page.waitForTimeout(2000)

    // 새로고침 후 값 유지 확인
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('월 총 예산')).toHaveValue('2000000', { timeout: 15000 })
  })
})
