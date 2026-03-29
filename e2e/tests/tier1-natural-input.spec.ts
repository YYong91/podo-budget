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

    // 4. "분석하기" 버튼 클릭 (TransactionForm 자연어 모드의 submit 버튼)
    const analyzeBtn = page.getByRole('button', { name: /분석하기/ })
    await expect(analyzeBtn).toBeVisible({ timeout: 10000 })
    await expect(analyzeBtn).toBeEnabled()

    // 분석 요청 → 프리뷰 대기 (chat API 응답을 명시적으로 대기)
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/chat') && res.status() < 500,
        { timeout: 30000 },
      ),
      analyzeBtn.click(),
    ])

    // 5. 프리뷰 영역 확인 — 금액 또는 설명이 표시되어야 함
    //    MockLLMProvider는 "8000" 금액을 반환
    //    프리뷰 렌더링 대기 — 상태 업데이트 + 리렌더링 시간 고려
    //    버튼 텍스트: "N건 저장하기" (예: "1건 저장하기")
    //    또는 "다시 입력" 버튼으로 프리뷰 모드 진입 확인
    const saveBtn = page.locator('button', { hasText: /저장하기/ }).last()
    await expect(saveBtn).toBeVisible({ timeout: 20000 })

    // 6. 저장 — POST 응답 대기 (expenses API)
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/expenses') && res.request().method() === 'POST' && res.status() < 400,
        { timeout: 15000 },
      ),
      saveBtn.click(),
    ])

    // 7. 저장 후 자동으로 /expenses(→ /?filter=expense)로 이동하거나 홈으로 이동
    //    navigate 호출이 500ms 지연이므로 대기
    await page.waitForTimeout(1500)
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // 생성된 지출이 목록에 표시되어야 함
    // MockLLMProvider가 반환한 description이 표시됨 (user_input 전체가 description)
    await expect(
      page.getByText(/김치찌개|8,000|8000/).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
