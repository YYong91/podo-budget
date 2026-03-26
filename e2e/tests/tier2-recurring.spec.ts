/**
 * Tier 2 정기 거래 E2E 테스트
 *
 * 정기 거래 페이지에서 추가·목록표시·실행(execute) 플로우를 검증한다.
 * API로 직접 정기 거래를 생성하고 UI에서 확인하는 패턴도 함께 사용한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 정기 거래 생성 헬퍼 */
async function createRecurring(
  page: Page,
  data: {
    type: 'expense' | 'income'
    amount: number
    description: string
    frequency?: string
    day_of_month?: number
  },
) {
  const token = await getAuthToken(page)
  const today = new Date().toISOString().slice(0, 10)
  const res = await page.request.post(`${API_URL}/api/recurring`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      type: data.type,
      amount: data.amount,
      description: data.description,
      frequency: data.frequency ?? 'monthly',
      day_of_month: data.day_of_month ?? 25,
      start_date: today,
    },
  })
  if (!res.ok()) {
    throw new Error(`정기 거래 생성 실패 (${res.status()}): ${await res.text()}`)
  }
  return res.json()
}

// TODO: 로컬 Playwright UI 모드에서 디버깅 필요 (#463)
test.describe.skip('정기 거래 관리', () => {
  test('정기 거래 페이지 이동 → 빈 상태 확인', async ({ authedPage: page }) => {
    await page.goto('/recurring')
    await page.waitForLoadState('networkidle')

    // 로딩 완료 대기 — 빈 상태 메시지 또는 추가 버튼이 표시될 때까지
    await expect(
      page.getByText('등록된 반복 거래가 없습니다').or(
        page.getByRole('button', { name: /추가/ }),
      ),
    ).toBeVisible({ timeout: 15000 })
  })

  test('정기 거래 추가 → 폼 작성 → 저장 → 목록에 표시', async ({ authedPage: page }) => {
    await page.goto('/recurring')
    await page.waitForLoadState('networkidle')

    // 로딩 완료 대기 — 추가 버튼 또는 빈 상태 표시
    await expect(
      page.getByRole('button', { name: /추가/ }).first().or(
        page.getByText('등록된 반복 거래가 없습니다'),
      ),
    ).toBeVisible({ timeout: 15000 })

    // 추가 버튼 클릭 — 모달 열기 (헤더 "추가" 버튼 사용, EmptyState에도 버튼이 있을 수 있음)
    await page.getByRole('button', { name: /추가/ }).first().click()

    // 모달이 열릴 때까지 대기 (role="dialog")
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('반복 거래 추가')).toBeVisible()

    // 모달에서 폼 작성
    // 설명 입력 (id: reclist-description)
    await page.locator('#reclist-description').fill('E2E 월세')
    // 금액 입력 (id: reclist-amount)
    await page.locator('#reclist-amount').fill('500000')

    // 추가하기 버튼 클릭 + API 응답 대기
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/recurring') && res.request().method() === 'POST' && res.status() < 400,
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: '추가하기' }).click(),
    ])

    // 목록에 추가된 항목 표시
    await expect(page.getByText('E2E 월세')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/500,000/).first()).toBeVisible()
  })

  test('API로 정기 거래 생성 → 목록에 표시', async ({ authedPage: page }) => {
    await createRecurring(page, {
      type: 'expense',
      amount: 89000,
      description: 'E2E 넷플릭스',
    })

    await page.goto('/recurring')
    await page.waitForLoadState('networkidle')

    // 목록 로딩 완료 대기 — 항목 또는 추가 버튼이 나타날 때까지
    await expect(
      page.getByText('E2E 넷플릭스').or(
        page.getByRole('button', { name: /추가/ }),
      ),
    ).toBeVisible({ timeout: 15000 })

    // 목록에 표시 확인
    await expect(page.getByText('E2E 넷플릭스')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/89,000/).first()).toBeVisible()
  })

  test('정기 거래 실행(execute) → 거래 목록에 반영', async ({ authedPage: page }) => {
    await createRecurring(page, {
      type: 'expense',
      amount: 15000,
      description: 'E2E 실행테스트',
    })

    await page.goto('/recurring')
    await page.waitForLoadState('networkidle')

    // 항목 표시 확인
    await expect(page.getByText('E2E 실행테스트')).toBeVisible({ timeout: 15000 })

    // 바로 등록(execute) 버튼 클릭 (title="바로 등록")
    // 데스크톱과 모바일 뷰 모두에서 찾기
    const executeBtn = page.getByTitle('바로 등록').first()
    await expect(executeBtn).toBeVisible({ timeout: 10000 })
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/recurring/') && res.url().includes('/execute') && res.status() < 400,
        { timeout: 15000 },
      ),
      executeBtn.click(),
    ])

    // 등록 성공 토스트 확인
    await expect(page.getByText(/등록되었습니다/).first()).toBeVisible({ timeout: 10000 })

    // 가계부 홈으로 이동하여 거래가 생성되었는지 확인
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('E2E 실행테스트').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/15,000/).first()).toBeVisible()
  })

  test('지출/수입 필터 탭 동작', async ({ authedPage: page }) => {
    // 지출형 + 수입형 정기 거래 순차 생성 (병렬 시 race condition 방지)
    await createRecurring(page, { type: 'expense', amount: 30000, description: 'E2E 지출정기' })
    await createRecurring(page, { type: 'income', amount: 200000, description: 'E2E 수입정기' })

    await page.goto('/recurring')
    await page.waitForLoadState('networkidle')

    // 전체 탭 — 둘 다 표시
    await expect(page.getByText('E2E 지출정기')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E 수입정기')).toBeVisible()

    // 지출 탭 클릭 — 필터 변경 시 API 재요청
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/recurring') && res.status() < 400,
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: '지출' }).click(),
    ])
    await expect(page.getByText('E2E 지출정기')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E 수입정기')).not.toBeVisible({ timeout: 5000 })

    // 수입 탭 클릭
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/recurring') && res.status() < 400,
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: '수입' }).click(),
    ])
    await expect(page.getByText('E2E 수입정기')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E 지출정기')).not.toBeVisible({ timeout: 5000 })
  })
})
