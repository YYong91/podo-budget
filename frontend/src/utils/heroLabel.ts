/**
 * 히어로카드 상단 라벨을 예산 상태에 따라 동적으로 생성합니다.
 *
 * 정적 "지출" 대신 사용자에게 방향감을 제공하는 컨텍스트 문장을 반환합니다.
 * - 현재 달: 앞으로 행동을 바꿀 여지가 있으므로 능동적 메시지
 * - 과거 달: 이미 결과가 확정됐으므로 사실적/회고적 메시지
 */
export function getHeroLabel(
  totalExpense: number,
  totalBudget: number | null | undefined,
  pendingRecurring: number,
  /** 1-indexed 월 (표시용) */
  month: number,
  isCurrentMonth: boolean,
): string {
  const monthLabel = isCurrentMonth ? '이번 달' : `${month}월`

  // 로딩 중 또는 예산 미설정 — 중립 라벨
  if (totalBudget === undefined || totalBudget === null || totalBudget <= 0) {
    return `${monthLabel} 지출`
  }

  // 실제 초과
  if (totalExpense > totalBudget) {
    return '예산을 넘었어요'
  }

  // 예상 초과 (미실행 정기지출 포함) — 현재 달에만 예측 메시지 표시
  if (isCurrentMonth && pendingRecurring > 0 && totalExpense + pendingRecurring > totalBudget) {
    return '예산 초과 직전이에요'
  }

  // totalExpense는 현재 API 설계상 음수가 될 수 없음 (환불은 별도 처리)
  const usedPct = (totalExpense / totalBudget) * 100

  if (usedPct >= 80) {
    return isCurrentMonth ? '지출 속도가 빨라요' : `${month}월 지출`
  }

  if (usedPct < 40) {
    return isCurrentMonth ? '여유 있는 한 달이에요' : '절약한 달이에요'
  }

  // 40~80% 구간 — 중립
  return `${monthLabel} 지출`
}
