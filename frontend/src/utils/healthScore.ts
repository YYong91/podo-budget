import type { HealthScore } from '../types'

interface HealthScoreInput {
  incomeTotal: number
  expenseTotal: number
  /** 저축성 지출 합계 (적금, 투자, 보험 등). 제공 시 저축률 = savingsTotal / incomeTotal */
  savingsTotal?: number
  budgetTotal?: number
  budgetSpent?: number
  totalLiabilities?: number
  totalAssets?: number
  avgLoanRate?: number
}

/**
 * 가계 건강 점수 계산 (코드 기반, LLM 미사용)
 *
 * - savings (저축률): 수입 대비 (수입-지출) 비율
 * - spending (지출관리): 예산 준수율
 * - debt (부채): 부채 비율 + 평균 이자율
 * - overall: 가중 평균 → grade
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScore {
  // 수입/지출 모두 0이면 데이터 없음 (신규 사용자) — 의미없는 점수 대신 '-' 등급 반환
  if (input.incomeTotal === 0 && input.expenseTotal === 0) {
    return { savings: 0, spending: 0, debt: 100, overall: 0, grade: '-' }
  }

  const {
    incomeTotal,
    expenseTotal,
    budgetTotal,
    budgetSpent,
    totalLiabilities = 0,
    totalAssets = 0,
    avgLoanRate = 0,
  } = input

  // 1. 저축률 점수 (0~100)
  // savingsTotal이 제공되면 저축성 지출 기반, 아니면 기존 (수입-지출)/수입 방식
  let savings = 0
  if (incomeTotal > 0) {
    const savingsRate = input.savingsTotal !== undefined
      ? (input.savingsTotal / incomeTotal) * 100
      : ((incomeTotal - expenseTotal) / incomeTotal) * 100
    if (savingsRate >= 50) savings = 100
    else if (savingsRate >= 0) savings = Math.round(30 + (savingsRate / 50) * 70)
    else savings = 0
  }

  // 2. 지출 관리 점수 (0~100)
  let spending = 70 // 기본값 (예산 미설정 시)
  if (budgetTotal && budgetTotal > 0 && budgetSpent !== undefined) {
    const usageRate = budgetSpent / budgetTotal
    if (usageRate <= 0.8) spending = 100
    else if (usageRate <= 1.0) spending = Math.round(100 - (usageRate - 0.8) * 250)
    else spending = Math.max(0, Math.round(50 - (usageRate - 1.0) * 100))
  }

  // 3. 부채 점수 (0~100)
  let debt = 100 // 기본값 (부채 없으면 만점)
  if (totalLiabilities > 0) {
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 2
    let ratioScore = 100
    if (debtRatio > 1) ratioScore = 20
    else if (debtRatio > 0.5) ratioScore = Math.round(60 - (debtRatio - 0.5) * 80)
    else ratioScore = Math.round(100 - debtRatio * 80)

    let rateScore = 100
    if (avgLoanRate > 10) rateScore = 20
    else if (avgLoanRate > 5) rateScore = Math.round(80 - (avgLoanRate - 5) * 12)
    else if (avgLoanRate > 0) rateScore = Math.round(100 - avgLoanRate * 4)

    debt = Math.round(ratioScore * 0.6 + rateScore * 0.4)
  }

  // 4. 종합 점수 (가중 평균)
  const overall = Math.round(savings * 0.4 + spending * 0.3 + debt * 0.3)

  // 5. 등급
  let grade: string
  if (overall >= 90) grade = 'A+'
  else if (overall >= 80) grade = 'A'
  else if (overall >= 70) grade = 'B+'
  else if (overall >= 60) grade = 'B'
  else if (overall >= 50) grade = 'C+'
  else if (overall >= 40) grade = 'C'
  else if (overall >= 30) grade = 'D'
  else grade = 'F'

  return { savings, spending, debt, overall, grade }
}
