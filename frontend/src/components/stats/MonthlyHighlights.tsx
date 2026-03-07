/**
 * @file MonthlyHighlights.tsx
 * @description 월간 전용 — 룰 기반 자동 하이라이트 (경고/성취/일반)
 */

import type { BudgetMonthlyStatsResponse, ComparisonResponse } from '../../types'

interface Highlight {
  type: 'warning' | 'positive' | 'info'
  message: string
}

interface HighlightInput {
  incomeTotal: number
  expenseTotal: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

export function generateHighlights({ incomeTotal, expenseTotal, budgetStats, comparison }: HighlightInput): Highlight[] {
  const highlights: Highlight[] = []
  const net = incomeTotal - expenseTotal

  // 1. 적자 경고 (최우선)
  if (incomeTotal > 0 && net < 0) {
    highlights.push({ type: 'warning', message: '이번 달 지출이 수입을 초과했습니다 ⚠️' })
  }

  // 2. 예산 초과 카테고리
  if (budgetStats) {
    budgetStats.categories.filter(c => c.is_exceeded).slice(0, 2).forEach(c => {
      const over = c.spent_amount - c.budget_amount
      highlights.push({
        type: 'warning',
        message: `${c.category_name} 예산을 ${over.toLocaleString('ko-KR')}원 초과했습니다`,
      })
    })
  }

  // 3. 저축률 달성
  if (incomeTotal > 0 && net >= 0) {
    const rate = (net / incomeTotal) * 100
    if (rate >= 20) {
      highlights.push({ type: 'positive', message: `이번 달 저축률 ${rate.toFixed(1)}% 달성 🎉` })
    }
  }

  // 4. 전월 대비 총지출 감소 (10% 이상)
  if (comparison?.change.percentage !== null && comparison?.change.percentage !== undefined) {
    if (comparison.change.percentage <= -10) {
      const pct = Math.abs(comparison.change.percentage).toFixed(1)
      highlights.push({ type: 'positive', message: `지난달보다 지출을 ${pct}% 줄였습니다 👍` })
    }
  }

  // 5. 카테고리 급증 (30% 이상)
  if (comparison) {
    comparison.by_category_comparison
      .filter(c => c.change_percentage !== null && c.change_percentage > 30)
      .slice(0, 2)
      .forEach(c => {
        highlights.push({
          type: 'info',
          message: `${c.category}가 지난달보다 ${Math.round(c.change_percentage!)}% 증가했습니다`,
        })
      })
  }

  // 우선순위: warning > positive > info, 최대 4개
  return [
    ...highlights.filter(h => h.type === 'warning'),
    ...highlights.filter(h => h.type === 'positive'),
    ...highlights.filter(h => h.type === 'info'),
  ].slice(0, 4)
}

interface MonthlyHighlightsProps {
  incomeTotal: number
  expenseTotal: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

const iconMap = { warning: '⚠️', positive: '✅', info: '•' } as const
const colorMap = { warning: 'text-amber-700', positive: 'text-leaf-700', info: 'text-warm-700' } as const

export default function MonthlyHighlights(props: MonthlyHighlightsProps) {
  const highlights = generateHighlights(props)
  if (highlights.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-4 sm:p-6">
      <h2 className="text-base font-semibold text-warm-900 mb-3">💡 이번 달 주목할 점</h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${colorMap[h.type]}`}>
            <span className="mt-0.5 flex-shrink-0">{iconMap[h.type]}</span>
            <span>{h.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
