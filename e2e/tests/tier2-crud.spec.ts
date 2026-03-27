/**
 * Tier 2 CRUD E2E 테스트 — 지출/수입 수정·삭제
 *
 * API로 데이터를 생성한 뒤 상세 페이지에서 수정·삭제 UI 동작을 검증한다.
 * 기존 expenses.spec.ts 패턴을 따르되, 수입(Income) 시나리오를 추가한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 지출 생성 헬퍼 */
async function createExpense(
  page: Page,
  data: { amount: number; description: string },
) {
  const token = await getAuthToken(page)
  const res = await page.request.post(`${API_URL}/api/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...data,
      date: new Date().toISOString().replace('Z', ''),
    },
  })
  if (!res.ok()) {
    throw new Error(`지출 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

/** API로 수입 생성 헬퍼 */
async function createIncome(
  page: Page,
  data: { amount: number; description: string },
) {
  const token = await getAuthToken(page)
  const res = await page.request.post(`${API_URL}/api/income`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...data,
      date: new Date().toISOString().replace('Z', ''),
    },
  })
  if (!res.ok()) {
    throw new Error(`수입 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

test.describe('지출 수정/삭제', () => {
  test('지출 수정 → 금액 변경 → 저장 → 변경 확인', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 12000,
      description: 'E2E 수정 테스트 지출',
    })

    // 상세 페이지로 이동
    await page.goto(`/expenses/${expense.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('E2E 수정 테스트 지출')).toBeVisible({ timeout: 15000 })

    // 수정 모드 진입
    await page.getByRole('button', { name: '수정' }).click()

    // 금액 필드 수정 (placeholder: "10000")
    const amountInput = page.getByPlaceholder('10000')
    await expect(amountInput).toBeVisible()
    await amountInput.fill('25000')

    // 저장 후 PUT 응답 대기
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/expenses/') && res.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: '저장' }).click(),
    ])

    // 변경된 금액 확인
    await expect(page.getByText(/25,000/).first()).toBeVisible({ timeout: 15000 })
  })

  test('지출 삭제 → 확인 → 목록에서 사라짐', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 7000,
      description: 'E2E 삭제 대상 지출',
    })

    await page.goto(`/expenses/${expense.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('E2E 삭제 대상 지출')).toBeVisible({ timeout: 15000 })

    // 삭제 버튼 클릭 → 확인 모달
    await page.getByRole('button', { name: '삭제' }).first().click()
    // 모달에서 삭제 확인
    await page.getByRole('button', { name: '삭제' }).last().click()

    // 홈으로 리디렉션 확인
    await expect(page).toHaveURL(/\//, { timeout: 15000 })
  })
})

test.describe('수입 수정/삭제', () => {
  test('수입 수정 → 금액 변경 → 저장 → 변경 확인', async ({ authedPage: page }) => {
    const income = await createIncome(page, {
      amount: 500000,
      description: 'E2E 수정 테스트 수입',
    })

    // 수입 상세 페이지로 이동
    await page.goto(`/income/${income.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('E2E 수정 테스트 수입')).toBeVisible({ timeout: 15000 })

    // 수정 모드 진입
    await page.getByRole('button', { name: '수정' }).click()

    // 금액 필드 수정 (id: "income-edit-amount")
    const amountInput = page.locator('#income-edit-amount')
    await expect(amountInput).toBeVisible()
    await amountInput.fill('750000')

    // 저장 후 PUT 응답 대기
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/income/') && res.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: '저장' }).click(),
    ])

    // 변경된 금액 확인
    await expect(page.getByText(/750,000/).first()).toBeVisible({ timeout: 15000 })
  })

  test('수입 삭제 → 확인 → 리디렉션', async ({ authedPage: page }) => {
    const income = await createIncome(page, {
      amount: 100000,
      description: 'E2E 삭제 대상 수입',
    })

    await page.goto(`/income/${income.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('E2E 삭제 대상 수입')).toBeVisible({ timeout: 15000 })

    // 삭제 버튼 클릭 → 확인 모달
    await page.getByRole('button', { name: '삭제' }).first().click()
    // 모달에서 삭제 확인
    await page.getByRole('button', { name: '삭제' }).last().click()

    // /income → /?filter=income 리디렉션
    await expect(page).toHaveURL(/\//, { timeout: 15000 })
  })
})
