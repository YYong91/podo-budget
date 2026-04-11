/**
 * @file MonthlyHighlights.tsx
 * @description 월간 전용 — 룰 기반 자동 하이라이트 (경고/성취/일반)
 *
 * 규칙 우선순위: warning > positive > info, 최대 4개
 * 딥링크: 클릭 가능한 항목은 onHighlightClick 콜백으로 sectionId 전달
 */

import type { BudgetMonthlyStatsResponse, ComparisonResponse } from '../../types'

type Highlight = {
  type: 'warning' | 'positive' | 'info'
  message: string
  deeplink: string | null
}

type HighlightInput = {
  incomeTotal: number
  expenseTotal: number
  savingsTotal?: number       // 실제 저축액 (수입 - 지출 - 정기지출 등 정확한 값)
  recurringTotal?: number     // 이번 달 고정비 합계
  prevSavingsTotal?: number   // 전월 저축액 (전월 대비 비교용)
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

export function generateHighlights({
  incomeTotal, expenseTotal, savingsTotal, recurringTotal, prevSavingsTotal,
  budgetStats, comparison,
}: HighlightInput): Highlight[] {
  const highlights: Highlight[] = []

  // 1. 적자 경고 (최우선)
  if (incomeTotal > 0 && expenseTotal > incomeTotal) {
    highlights.push({ type: 'warning', message: '이번 달 지출이 수입을 초과했어요', deeplink: null })
  }

  // 2. 예산 초과 카테고리 (최대 2개)
  if (budgetStats) {
    budgetStats.categories.filter(c => c.is_exceeded).slice(0, 2).forEach(c => {
      const over = c.spent_amount - c.budget_amount
      highlights.push({
        type: 'warning',
        message: `${c.category_name} 예산을 ${over.toLocaleString('ko-KR')}원 초과했어요`,
        deeplink: 'section-budget',
      })
    })
  }

  // 3. 저축률 달성 (savingsTotal 제공 시에만, 20% 이상)
  // savingsTotal이 undefined면 규칙 스킵 — 부정확한 fallback 계산 방지
  if (savingsTotal !== undefined && incomeTotal > 0) {
    const rate = (savingsTotal / incomeTotal) * 100
    if (rate >= 20) {
      highlights.push({
        type: 'positive',
        message: `이번 달 저축률 ${rate.toFixed(1)}% 달성 🎉`,
        deeplink: 'section-savings',
      })
    }
  }

  // 4. 지출 감소 (10% 이상)
  if (comparison?.change.percentage !== null && comparison?.change.percentage !== undefined) {
    if (comparison.change.percentage <= -10) {
      const pct = Math.abs(comparison.change.percentage).toFixed(1)
      highlights.push({
        type: 'positive',
        message: `지난달보다 지출을 ${pct}% 줄였어요 👍`,
        deeplink: 'section-comparison',
      })
    }
  }

  // 5. 고정비 비율 >= 40% (신규)
  if (recurringTotal !== undefined && incomeTotal > 0) {
    const pct = (recurringTotal / incomeTotal) * 100
    if (pct >= 40) {
      highlights.push({
        type: 'info',
        message: `수입의 ${pct.toFixed(0)}%가 고정비예요`,
        deeplink: 'section-recurring',
      })
    }
  }

  // 6. 저축 감소 (전월 대비, savingsTotal 제공 시에만)
  if (savingsTotal !== undefined && prevSavingsTotal !== undefined && prevSavingsTotal > 0 && savingsTotal < prevSavingsTotal) {
    highlights.push({
      type: 'info',
      message: '지난달보다 저축이 줄었어요',
      deeplink: 'section-savings',
    })
  }

  // 7. 카테고리 급증 (30% 이상, 최대 2개)
  if (comparison) {
    comparison.by_category_comparison
      .filter(c => c.change_percentage !== null && c.change_percentage > 30)
      .slice(0, 2)
      .forEach(c => {
        highlights.push({
          type: 'info',
          message: `${c.category}가 지난달보다 ${Math.round(c.change_percentage!)}% 증가했어요`,
          deeplink: 'section-category',
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

type MonthlyHighlightsProps = {
  incomeTotal: number
  expenseTotal: number
  savingsTotal?: number
  recurringTotal?: number
  prevSavingsTotal?: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
  onHighlightClick?: (sectionId: string) => void
}

const iconMap = { warning: '⚠️', positive: '✅', info: '•' } as const
const colorMap = { warning: 'text-amber-600', positive: 'text-leaf-600', info: 'text-[var(--text-secondary)]' } as const

export default function MonthlyHighlights({
  incomeTotal, expenseTotal, savingsTotal, recurringTotal, prevSavingsTotal,
  budgetStats, comparison, onHighlightClick,
}: MonthlyHighlightsProps) {
  const highlights = generateHighlights({ incomeTotal, expenseTotal, savingsTotal, recurringTotal, prevSavingsTotal, budgetStats, comparison })
  if (highlights.length === 0) return null

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-4 sm:p-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">💡 이번 달 주목할 점</h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => (
          <li
            key={i}
            className={`text-sm flex items-start gap-2 ${colorMap[h.type]} ${h.deeplink ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => h.deeplink && onHighlightClick?.(h.deeplink)}
          >
            <span className="mt-0.5 flex-shrink-0">{iconMap[h.type]}</span>
            <span>{h.message}</span>
            {h.deeplink && <span className="ml-auto text-xs opacity-50">→</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
