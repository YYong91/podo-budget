/**
 * 지출 CRUD E2E 테스트
 *
 * ExpenseForm(입력), ExpenseDetail(상세/수정/삭제)를 검증한다.
 * API 헬퍼로 테스트 데이터를 생성한 뒤 UI 동작을 확인한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 지출 생성하는 헬퍼 — 쿠키에서 토큰을 읽어 Bearer 헤더로 전달 */
async function createExpense(
  page: Page,
  data: { amount: number; description: string },
) {
  const token = await getAuthToken(page)

  const res = await page.request.post(`${API_URL}/api/expenses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...data,
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

test.describe('지출 CRUD', () => {
  test('직접 입력 폼 UI 확인', async ({ authedPage: page }) => {
    await page.goto('/expenses/new')
    await page.waitForLoadState('networkidle')

    // "직접 입력" 모드 전환 (ExpenseForm의 모드 탭 버튼)
    await page.getByRole('button', { name: '직접 입력' }).click()

    // 폼 입력 필드 확인 (placeholder 기반)
    const amountInput = page.getByPlaceholder('10000')
    const descInput = page.getByPlaceholder('김치찌개')
    await expect(amountInput).toBeVisible({ timeout: 10000 })
    await expect(descInput).toBeVisible()

    // 필드 입력 가능 확인
    await amountInput.fill('15000')
    await descInput.fill('E2E 테스트 점심')
    await expect(amountInput).toHaveValue('15000')
    await expect(descInput).toHaveValue('E2E 테스트 점심')

    // 저장 버튼 존재 확인
    await expect(page.getByRole('button', { name: '저장하기' })).toBeVisible()
  })

  test('지출 상세 보기', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 8000,
      description: 'E2E 상세 테스트',
    })

    await page.goto(`/expenses/${expense.id}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('E2E 상세 테스트')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/8,000/).first()).toBeVisible()
  })

  test('지출 수정', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 5000,
      description: 'E2E 수정 전',
    })

    await page.goto(`/expenses/${expense.id}`)
    await page.waitForLoadState('networkidle')

    // 상세 페이지 로딩 대기
    await expect(page.getByText('E2E 수정 전')).toBeVisible({ timeout: 15000 })

    // 수정 모드 진입
    await page.getByRole('button', { name: '수정' }).click()

    // 설명 필드 수정 (TransactionDetail 편집 모드 — id="edit-description")
    const descInput = page.locator('#edit-description')
    await expect(descInput).toBeVisible()
    await descInput.fill('E2E 수정 후')

    // 저장 후 PUT 응답 대기
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/expenses/') && res.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: '저장' }).click(),
    ])

    // 수정된 내용 확인
    await expect(page.getByText('E2E 수정 후')).toBeVisible({ timeout: 15000 })
  })

  test('지출 삭제', async ({ authedPage: page }) => {
    const expense = await createExpense(page, {
      amount: 3000,
      description: 'E2E 삭제 대상',
    })

    await page.goto(`/expenses/${expense.id}`)
    await page.waitForLoadState('networkidle')

    // 상세 페이지 로딩 대기
    await expect(page.getByText('E2E 삭제 대상')).toBeVisible({ timeout: 15000 })

    // 삭제 버튼 클릭 → 확인 모달 표시
    await page.getByRole('button', { name: '삭제' }).first().click()

    // 확인 모달에서 삭제 클릭
    await page.getByRole('button', { name: '삭제' }).last().click()

    // 홈 페이지로 리디렉션 (ExpenseDetail handleDelete → navigate('/expenses') → redirect '/?filter=expense')
    await expect(page).toHaveURL(/\//, { timeout: 15000 })
  })
})
