/**
 * 가구 관리 E2E 테스트 (Tier 3)
 *
 * HouseholdListPage, HouseholdDetailPage의 목록, 생성,
 * 멤버 확인, 설정 탭 이름 수정을 검증한다.
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'
import type { Page } from '@playwright/test'

/** API로 가구 생성하는 헬퍼 */
async function createHousehold(
  page: Page,
  data: { name: string; description?: string },
): Promise<{ id: number; name: string }> {
  const token = await getAuthToken(page)

  const res = await page.request.post(`${API_URL}/api/households`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`가구 생성 API 실패 (${res.status()}): ${body}`)
  }
  return res.json()
}

test.describe('가구 관리', () => {
  test('가구 목록 페이지 이동', async ({ authedPage: page }) => {
    await page.goto('/households')
    await page.waitForLoadState('networkidle')

    // 가구 목록 페이지가 로드됨 — "가구 만들기" 버튼 또는 기존 가구 카드
    // E2E setup이 자동으로 기본 가구를 생성하므로 목록에 1개 이상 표시
    await expect(
      page.getByText('가구 만들기').or(page.locator('[role="button"]').first()),
    ).toBeVisible({ timeout: 15000 })
  })

  test('새 가구 생성 → 목록에 표시', async ({ authedPage: page }) => {
    // API로 가구 생성
    const household = await createHousehold(page, {
      name: 'E2E 테스트 가구',
      description: 'E2E 테스트용 가구입니다',
    })

    // 가구 목록 페이지로 이동
    await page.goto('/households')
    await page.waitForLoadState('networkidle')

    // 생성한 가구가 목록에 보여야 함
    await expect(page.getByText('E2E 테스트 가구')).toBeVisible({ timeout: 15000 })
  })

  test('가구 상세 이동 → 멤버 목록 확인', async ({ authedPage: page }) => {
    // API로 가구 생성
    const household = await createHousehold(page, {
      name: 'E2E 멤버 확인 가구',
    })

    // 가구 상세 페이지로 이동
    await page.goto(`/households/${household.id}`)
    await page.waitForLoadState('networkidle')

    // 멤버 탭이 기본 활성이고, 멤버 목록이 보여야 함
    // owner(현재 유저)가 멤버로 표시됨
    await expect(page.getByText('멤버').first()).toBeVisible({ timeout: 15000 })

    // 소유자 역할 배지가 보여야 함
    await expect(page.getByText('소유자').first()).toBeVisible()
  })

  test('가구 설정 탭 → 이름 수정', async ({ authedPage: page }) => {
    // API로 가구 생성
    const household = await createHousehold(page, {
      name: 'E2E 수정 전 가구',
    })

    // 가구 상세 페이지로 이동
    await page.goto(`/households/${household.id}`)
    await page.waitForLoadState('networkidle')

    // 설정 탭 클릭 (owner/admin만 보임 — E2E 유저는 owner)
    await page.getByText('설정', { exact: true }).click()

    // 가구 이름 입력 필드가 보여야 함
    const nameInput = page.locator('input').first()
    await expect(nameInput).toBeVisible({ timeout: 15000 })

    // 이름 수정
    await nameInput.fill('E2E 수정 후 가구')

    // 저장 버튼 클릭 + PUT 응답 대기
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/households/') && res.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: /저장/ }).click(),
    ])

    // 수정된 이름이 반영되었는지 확인 — 페이지 새로고침 후 확인
    await page.goto(`/households/${household.id}`)
    await page.waitForLoadState('networkidle')

    // 설정 탭에서 수정된 이름이 보여야 함
    await page.getByText('설정', { exact: true }).click()
    const updatedInput = page.locator('input').first()
    await expect(updatedInput).toHaveValue('E2E 수정 후 가구', { timeout: 15000 })
  })
})
