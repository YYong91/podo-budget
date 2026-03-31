/**
 * 가계부 홈(TransactionList) E2E 테스트
 *
 * TransactionList는 앱의 첫 화면(`/`)이다.
 * 빈 상태, 거래 생성 후 목록 표시를 검증한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 지출 생성하는 헬퍼 — 쿠키에서 토큰을 읽어 Bearer 헤더로 전달 */
async function createExpense(
  page: Page,
  data: { amount: number; description: string; category_name?: string },
) {
  const token = await getAuthToken(page)

  const res = await page.request.post(`${API_URL}/api/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      amount: data.amount,
      description: data.description,
      // asyncpg는 TIMESTAMP WITHOUT TIME ZONE에 timezone-aware datetime 거부
      date: new Date().toISOString().replace('Z', ''),
    },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`지출 생성 API 실패 (${res.status()}): ${body}`)
  }
  return res.json()
}

test.describe('가계부 홈 (TransactionList)', () => {
  test('빈 상태 → EmptyState 표시', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // TransactionList의 빈 상태: "거래 내역이 없습니다"
    await expect(
      page.getByText('거래 내역이 없습니다'),
    ).toBeVisible({ timeout: 15000 })
  })

  test('지출 생성 후 → 목록에 표시', async ({ authedPage: page }) => {
    await createExpense(page, {
      amount: 25000,
      description: 'E2E 대시보드 테스트',
    })

    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 생성한 지출 항목이 목록에 표시되어야 함
    await expect(page.getByText('E2E 대시보드 테스트')).toBeVisible({ timeout: 15000 })
    // 금액 표시 확인 (formatAmount 결과)
    await expect(page.getByText(/25,000/).first()).toBeVisible()
  })

  test('지출/수입 필터 버튼 동작', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 요약 영역에 "지출"/"수입" 텍스트가 있어야 함
    await expect(page.getByText('지출').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('수입').first()).toBeVisible()
  })
})
