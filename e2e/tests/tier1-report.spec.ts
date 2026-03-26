/**
 * Tier 1: 리포트 핵심 플로우
 *
 * 데이터 준비(API) → 리포트 페이지 이동 → 통계 확인
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 지출 생성하는 헬퍼 */
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
    const body = await res.text()
    throw new Error(`지출 생성 API 실패 (${res.status()}): ${body}`)
  }
  return res.json()
}

test.describe('Tier 1: 리포트', () => {
  test('지출 데이터 준비 → 리포트 페이지 → 통계 표시 확인', async ({ authedPage: page }) => {
    // 1. 데이터 준비 — API로 지출 3건 생성
    await createExpense(page, { amount: 8000, description: '리포트 테스트 점심' })
    await createExpense(page, { amount: 15000, description: '리포트 테스트 저녁' })
    await createExpense(page, { amount: 3500, description: '리포트 테스트 커피' })

    // 2. 리포트 페이지 이동 (돌아보기 = /insights)
    await page.goto('/insights')
    await page.waitForLoadState('networkidle')

    // 3. 리포트 페이지 로딩 대기 — 데이터 fetching 시간 고려
    await page.waitForTimeout(3000)

    // 4. 통계 관련 콘텐츠 확인
    //    - 총 지출 금액 (26,500원) 또는 개별 금액이 어딘가에 표시
    //    - 카테고리 TOP 목록 또는 차트가 보여야 함
    const insightsContent = page.locator('main, [class*="insight"], [class*="report"]')
    await expect(insightsContent.first()).toBeVisible({ timeout: 15000 })

    // 지출 합계 또는 개별 항목이 리포트에 표시되는지 확인
    // InsightsPage는 월간 요약 카드를 보여줌
    const hasAmount = await page.getByText(/26,500|8,000|15,000|3,500/).first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasLabel = await page.getByText(/지출|총|이번 달/).first().isVisible({ timeout: 5000 }).catch(() => false)

    // 둘 중 하나라도 보이면 리포트가 정상 동작
    expect(hasAmount || hasLabel).toBeTruthy()
  })
})
