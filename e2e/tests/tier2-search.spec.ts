/**
 * Tier 2 검색 E2E 테스트
 *
 * API로 다양한 지출/수입을 생성한 뒤 검색 모드 진입, 검색어 입력,
 * 결과 확인, 필터 전환, 검색 모드 해제를 검증한다.
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

test.describe('검색 기능', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    // 다양한 지출/수입 5건 + 1건 생성
    await Promise.all([
      createExpense(page, { amount: 8000, description: 'E2E검색 김치찌개' }),
      createExpense(page, { amount: 15000, description: 'E2E검색 삼겹살' }),
      createExpense(page, { amount: 3000, description: 'E2E검색 커피' }),
      createExpense(page, { amount: 50000, description: 'E2E검색 마트장보기' }),
      createExpense(page, { amount: 12000, description: 'E2E검색 택시비' }),
      createIncome(page, { amount: 3000000, description: 'E2E검색 월급' }),
    ])
  })

  test('검색 아이콘 클릭 → 검색 모드 진입', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 월뷰에서 검색 버튼 클릭 (aria-label="검색")
    await page.getByRole('button', { name: '검색' }).click()

    // 검색 입력 필드가 나타남
    const searchInput = page.getByPlaceholder('거래 내역 검색')
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('검색어 입력 → 결과 확인', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 검색 모드 진입
    await page.getByRole('button', { name: '검색' }).click()

    // 검색어 입력 후 Enter
    const searchInput = page.getByPlaceholder('거래 내역 검색')
    await searchInput.fill('김치찌개')
    await searchInput.press('Enter')

    // 검색 결과에 '김치찌개'가 표시됨
    await expect(page.getByText('E2E검색 김치찌개')).toBeVisible({ timeout: 15000 })
    // 다른 항목은 표시되지 않음
    await expect(page.getByText('E2E검색 삼겹살')).not.toBeVisible()
  })

  test('지출/수입 필터 전환 → 결과 변화', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 검색 모드 진입
    await page.getByRole('button', { name: '검색' }).click()

    // 'E2E검색' 검색 → 지출 5건 + 수입 1건 모두 표시
    const searchInput = page.getByPlaceholder('거래 내역 검색')
    await searchInput.fill('E2E검색')
    await searchInput.press('Enter')

    // 지출과 수입 모두 표시됨
    await expect(page.getByText('E2E검색 김치찌개')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E검색 월급')).toBeVisible()

    // '지출/수입' 필터 칩 클릭하여 드롭다운 열기
    await page.getByText('지출/수입').click()
    // '수입만' 선택
    await page.getByText('수입만').click()

    // 수입만 표시됨 — 지출은 사라짐
    await expect(page.getByText('E2E검색 월급')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E검색 김치찌개')).not.toBeVisible()
  })

  test('검색 모드 해제 → 월뷰 복귀', async ({ authedPage: page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 검색 모드 진입
    await page.getByRole('button', { name: '검색' }).click()
    await expect(page.getByPlaceholder('거래 내역 검색')).toBeVisible({ timeout: 10000 })

    // 검색 닫기 버튼 클릭 (aria-label="검색 닫기")
    await page.getByRole('button', { name: '검색 닫기' }).click()

    // 검색 입력이 사라지고 월 네비게이션이 다시 보임
    await expect(page.getByPlaceholder('거래 내역 검색')).not.toBeVisible()
    // 검색 버튼(아이콘)이 다시 나타남
    await expect(page.getByRole('button', { name: '검색' })).toBeVisible({ timeout: 10000 })
  })
})
