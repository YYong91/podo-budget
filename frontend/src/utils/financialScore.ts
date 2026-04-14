import type { FinancialScore, FinancialScoreBreakdown } from '../types'

export interface FinancialScoreInput {
  incomeTotal: number
  savingsTotal: number | undefined // is_savings 카테고리 없으면 undefined
  budgetTotal: number | undefined // 예산 미설정이면 undefined
  budgetSpent: number | undefined
  budgetCategories: number // 예산 설정된 카테고리 수
  expenseCategories: number // 이번 달 지출 있는 카테고리 수
  recurringNonSavings: number | undefined // 실행된 비저축성 정기거래 합계
  monthlyVariableExpenses: number[] // 직전 3개월 변동 지출 (완료된 달 순서)
  targetYear: number
  targetMonth: number // 1-indexed (1~12)
  today: Date
}

// ── 등급 산출 ──
function calcGrade(overall: number): string {
  if (overall >= 90) return 'A+'
  if (overall >= 80) return 'A'
  if (overall >= 70) return 'B+'
  if (overall >= 60) return 'B'
  if (overall >= 50) return 'C+'
  if (overall >= 40) return 'C'
  if (overall >= 30) return 'D'
  return 'F'
}

// ── 저축률 ──
function calcSavingsRate(
  savingsTotal: number | undefined,
  incomeTotal: number,
): { score: number | null; summary: string; detail?: string } {
  if (incomeTotal <= 0 || savingsTotal === undefined) {
    return {
      score: null,
      summary: '',
      detail: '저축 카테고리를 설정하면 측정돼요',
    }
  }
  const clamped = Math.max(0, savingsTotal)
  const ratio = (clamped / incomeTotal) * 100
  let score: number
  if (ratio >= 30) score = 100
  else if (ratio >= 20) score = 80 + ((ratio - 20) / 10) * 20
  else if (ratio >= 10) score = 50 + ((ratio - 10) / 10) * 30
  else score = (ratio / 10) * 50

  const savingsWan = Math.round(clamped / 10000)
  const incomeWan = Math.round(incomeTotal / 10000)
  return {
    score: Math.round(score),
    summary: `저축 ${savingsWan}만원 / 수입 ${incomeWan}만원 = ${ratio.toFixed(1)}%`,
  }
}

// ── 예산 준수율 ──
function calcBudgetAdherence(
  budgetTotal: number | undefined,
  budgetSpent: number | undefined,
  budgetCategories: number,
  expenseCategories: number,
  incomeTotal: number,
  targetYear: number,
  targetMonth: number,
  today: Date,
): { score: number | null; summary: string; detail?: string } {
  if (!budgetTotal || !budgetSpent) {
    return { score: null, summary: '', detail: '예산을 설정하면 측정돼요' }
  }

  const isCurrentMonth =
    today.getFullYear() === targetYear && today.getMonth() + 1 === targetMonth
  const dayOfMonth = isCurrentMonth
    ? today.getDate()
    : new Date(targetYear, targetMonth, 0).getDate() // 해당 월 말일
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate()
  const elapsedRatio = dayOfMonth / daysInMonth

  const usageRate = budgetSpent / budgetTotal
  const paceRatio = usageRate / elapsedRatio

  // Step 1: 페이스 보정 점수 (70%)
  let paceScore: number
  if (paceRatio <= 0.7) paceScore = 100
  else if (paceRatio <= 0.9) paceScore = 80 + ((0.9 - paceRatio) / 0.2) * 20
  else if (paceRatio <= 1.1) paceScore = 60 + ((1.1 - paceRatio) / 0.2) * 20
  else if (paceRatio <= 1.3) paceScore = 30 + ((1.3 - paceRatio) / 0.2) * 30
  else paceScore = Math.max(0, 30 - (paceRatio - 1.3) * 50)

  // Step 2: 적정성 점수 (30%)
  const coverage = expenseCategories > 0 ? budgetCategories / expenseCategories : 0
  let coverageScore: number
  if (coverage >= 0.7) coverageScore = 100
  else if (coverage >= 0.3) coverageScore = (coverage / 0.7) * 100
  else coverageScore = 30

  let realityScore: number
  if (incomeTotal <= 0) {
    realityScore = 50
  } else {
    const ratio = budgetTotal / incomeTotal
    if (ratio >= 0.5 && ratio <= 0.9) realityScore = 100
    else if ((ratio >= 0.3 && ratio < 0.5) || (ratio > 0.9 && ratio <= 1.2))
      realityScore = 70
    else if (ratio > 1.2) realityScore = 40
    else realityScore = 50
  }

  const adequacyScore = coverageScore * 0.5 + realityScore * 0.5
  const finalScore = paceScore * 0.7 + adequacyScore * 0.3

  const usagePct = Math.round(usageRate * 100)
  const budgetWan = Math.round(budgetTotal / 10000)
  const spentWan = Math.round(budgetSpent / 10000)

  let paceText: string
  if (paceRatio <= 0.9) paceText = '여유'
  else if (paceRatio <= 1.1) paceText = '적정'
  else if (paceRatio <= 1.3) paceText = '다소 빠름'
  else paceText = '주의 필요'

  const detail = isCurrentMonth
    ? `⏱ 월 ${dayOfMonth}일차 기준 페이스 ${paceText}`
    : `⏱ ${targetMonth}월 전체 기준`

  return {
    score: Math.round(finalScore),
    summary: `예산 ${budgetWan}만원 중 ${spentWan}만원 사용 (${usagePct}%)`,
    detail,
  }
}

// ── 고정비 비율 ──
function calcFixedExpenseRatio(
  recurringNonSavings: number | undefined,
  incomeTotal: number,
): { score: number | null; summary: string; detail?: string } {
  if (incomeTotal <= 0 || recurringNonSavings === undefined) {
    return { score: null, summary: '', detail: '정기거래를 등록하면 측정돼요' }
  }
  const ratio = (recurringNonSavings / incomeTotal) * 100

  let score: number
  if (ratio <= 30) score = 100
  else if (ratio <= 40) score = 70 + ((40 - ratio) / 10) * 30
  else if (ratio <= 50) score = 40 + ((50 - ratio) / 10) * 30
  else if (ratio <= 70) score = 20 + ((70 - ratio) / 20) * 20
  else score = Math.max(0, 20 - ((ratio - 70) / 30) * 20)

  const recurringWan = Math.round(recurringNonSavings / 10000)
  const incomeWan = Math.round(incomeTotal / 10000)
  return {
    score: Math.round(score),
    summary: `고정비 ${recurringWan}만원 / 수입 ${incomeWan}만원 = ${ratio.toFixed(1)}%`,
  }
}

// ── 소비 안정성 ──
function calcSpendingStability(
  monthlyVariableExpenses: number[],
): { score: number | null; summary: string; detail?: string } {
  if (monthlyVariableExpenses.length < 3) {
    return { score: null, summary: '', detail: '3개월 이상 기록되면 측정돼요' }
  }

  const mean =
    monthlyVariableExpenses.reduce((a, b) => a + b, 0) / monthlyVariableExpenses.length
  if (mean === 0) {
    return { score: null, summary: '', detail: '3개월 이상 기록되면 측정돼요' }
  }

  const variance =
    monthlyVariableExpenses.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
    monthlyVariableExpenses.length
  const stddev = Math.sqrt(variance)
  const cv = (stddev / mean) * 100

  let score: number
  if (cv <= 10) score = 100
  else if (cv <= 20) score = 80 + ((20 - cv) / 10) * 20
  else if (cv <= 30) score = 60 + ((30 - cv) / 10) * 20
  else if (cv <= 50) score = 30 + ((50 - cv) / 20) * 30
  else score = Math.max(0, 30 - ((cv - 50) / 50) * 30)

  return {
    score: Math.round(score),
    summary: `최근 3개월 변동 지출 변동계수 ${cv.toFixed(1)}%`,
  }
}

// ── 메인 함수 ──
export function calculateFinancialScore(input: FinancialScoreInput): FinancialScore {
  const {
    incomeTotal,
    savingsTotal,
    budgetTotal,
    budgetSpent,
    budgetCategories,
    expenseCategories,
    recurringNonSavings,
    monthlyVariableExpenses,
    targetYear,
    targetMonth,
    today,
  } = input

  const sr = calcSavingsRate(savingsTotal, incomeTotal)
  const ba = calcBudgetAdherence(
    budgetTotal,
    budgetSpent,
    budgetCategories,
    expenseCategories,
    incomeTotal,
    targetYear,
    targetMonth,
    today,
  )
  const fer = calcFixedExpenseRatio(recurringNonSavings, incomeTotal)
  const ss = calcSpendingStability(monthlyVariableExpenses)

  // 가중치 재분배
  const weights = {
    savingsRate: sr.score !== null ? 35 : 0,
    budgetAdherence: ba.score !== null ? 25 : 0,
    fixedExpenseRatio: fer.score !== null ? 20 : 0,
    spendingStability: ss.score !== null ? 20 : 0,
  }
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const activeIndicators = Object.values(weights).filter((w) => w > 0).length

  let overall = 0
  if (totalWeight > 0) {
    overall = Math.round(
      ((sr.score ?? 0) * weights.savingsRate +
        (ba.score ?? 0) * weights.budgetAdherence +
        (fer.score ?? 0) * weights.fixedExpenseRatio +
        (ss.score ?? 0) * weights.spendingStability) /
        totalWeight,
    )
  }

  const breakdown: FinancialScoreBreakdown = {
    savingsRate: { score: sr.score, summary: sr.summary, detail: sr.detail },
    budgetAdherence: { score: ba.score, summary: ba.summary, detail: ba.detail },
    fixedExpenseRatio: { score: fer.score, summary: fer.summary, detail: fer.detail },
    spendingStability: { score: ss.score, summary: ss.summary, detail: ss.detail },
  }

  return {
    savingsRate: sr.score,
    budgetAdherence: ba.score,
    fixedExpenseRatio: fer.score,
    spendingStability: ss.score,
    overall,
    grade: activeIndicators === 0 ? '-' : calcGrade(overall),
    activeIndicators,
    breakdown,
  }
}
