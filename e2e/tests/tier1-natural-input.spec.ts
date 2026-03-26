/**
 * Tier 1: 자연어 입력 핵심 플로우
 *
 * LLM_PROVIDER=mock 환경에서 실행 (MockLLMProvider가 결정적 응답 반환)
 * 자연어 입력 → 프리뷰 → 저장 → 홈 목록 확인
 */

import { test, expect, API_URL } from '../fixtures/auth'
import { getAuthToken } from '../fixtures/auth'

test.describe('Tier 1: 자연어 지출 입력', () => {
  test('자연어 입력 → 프리뷰 확인 → 저장 → 홈 목록 표시', async ({ authedPage: page }) => {
    // 1. 지출 입력 페이지 이동
    await page.goto('/expenses/new')
    await page.waitForLoadState('networkidle')

    // 2. 자연어 입력 모드 — 기본 모드가 자연어
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 15000 })

    // 3. 자연어 텍스트 입력
    await textarea.fill('점심 김치찌개 8000원')

    // 4. 분석 버튼 클릭 (AI 분석 or 파싱 요청)
    const analyzeBtn = page.getByRole('button', { name: /분석|확인|파싱/ })
    if (await analyzeBtn.isVisible({ timeout: 3000 })) {
      // 분석 요청 → 프리뷰 대기
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/api/') && res.status() < 500,
          { timeout: 15000 },
        ),
        analyzeBtn.click(),
      ])
    } else {
      // Enter로 제출하는 방식일 수 있음
      await textarea.press('Enter')
      await page.waitForResponse(
        (res) => res.url().includes('/api/') && res.status() < 500,
        { timeout: 15000 },
      )
    }

    // 5. 프리뷰 영역 확인 — 금액 또는 설명이 표시되어야 함
    //    MockLLMProvider는 "8000" 금액을 반환
    await page.waitForTimeout(2000) // 프리뷰 렌더링 대기

    // 프리뷰 또는 저장 가능 상태 확인
    const saveBtn = page.getByRole('button', { name: /저장|확인/ })
    await expect(saveBtn).toBeVisible({ timeout: 15000 })

    // 6. 저장
    await saveBtn.click()

    // 7. 홈으로 이동하여 목록에서 확인
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 생성된 지출이 목록에 표시되어야 함
    // MockLLMProvider가 반환한 description이 표시됨
    await expect(
      page.getByText(/김치찌개|8,000|8000/).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
