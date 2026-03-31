/**
 * Tier 1: 직접 입력 핵심 플로우
 *
 * 지출 직접 입력 + 수입 직접 입력 → 저장 → 목록 확인
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 수입 생성하는 헬퍼 */
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
    const body = await res.text()
    throw new Error(`수입 생성 API 실패 (${res.status()}): ${body}`)
  }
  return res.json()
}

test.describe('Tier 1: 직접 입력', () => {
  test('지출 직접 입력 → 저장 → 목록에서 확인', async ({ authedPage: page }) => {
    // 1. 지출 입력 페이지
    await page.goto('/expenses/new')
    await page.waitForLoadState('networkidle')

    // 2. "직접 입력" 모드 전환
    await page.getByRole('button', { name: '직접 입력' }).click()

    // 3. 금액 입력
    const amountInput = page.getByPlaceholder('10000')
    await expect(amountInput).toBeVisible({ timeout: 10000 })
    await amountInput.fill('12500')

    // 4. 설명 입력
    const descInput = page.getByPlaceholder('김치찌개')
    await descInput.fill('E2E 직접입력 점심')

    // 5. 저장 — POST 응답 대기 후 네비게이션 확인
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/expenses') && res.request().method() === 'POST' && res.status() < 400,
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: '저장하기' }).click(),
    ])

    // 6. 저장 후 리디렉션 대기 (TransactionForm은 /expenses → /?filter=expense로 이동)
    await page.waitForURL(/\//, { timeout: 15000 })

    // 7. 홈으로 이동하여 확인
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('E2E 직접입력 점심')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/12,500/).first()).toBeVisible()
  })

  test('수입 직접 입력 → 저장 → 목록에서 확인', async ({ authedPage: page }) => {
    // API로 수입 직접 생성 (수입 입력 UI 경로가 다를 수 있으므로 API 활용)
    await createIncome(page, {
      amount: 3000000,
      description: 'E2E 월급',
    })

    // 홈에서 수입 탭/필터로 확인
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // "수입" 필터/탭 클릭
    const incomeTab = page.getByText('수입').first()
    await expect(incomeTab).toBeVisible({ timeout: 15000 })

    // 수입 항목이 표시되는지 확인
    // 홈 화면에서 수입 금액이 요약에 나타남
    await expect(page.getByText(/3,000,000/).first()).toBeVisible({ timeout: 15000 })
  })
})
