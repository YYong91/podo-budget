/**
 * @file BudgetVsActual.tsx
 * @description 월간 예산 대비 지출 상황 — props 방식 (데이터는 InsightsPage에서 주입)
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { BudgetMonthlyStatsResponse } from '../../types'
import { formatAmount } from '../../utils/format'

interface BudgetVsActualProps {
  budgetStats: BudgetMonthlyStatsResponse | null
  maxItems?: number
  monthStr?: string
}

export default function BudgetVsActual({ budgetStats, maxItems = 5, monthStr }: BudgetVsActualProps) {
  const [expanded, setExpanded] = useState(false)

  if (!budgetStats || budgetStats.categories.length === 0) return null

  const totalBudget = budgetStats.total_budget
  const totalSpent = budgetStats.total_spent
  const totalUsage = totalBudget && totalBudget > 0 ? (totalSpent / totalBudget) * 100 : null

  const hasMore = budgetStats.categories.length > maxItems
  const visible = expanded ? budgetStats.categories : budgetStats.categories.slice(0, maxItems)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6" data-testid="budget-vs-actual">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">💰 예산 상황</h2>
        <Link to="/budgets" className="text-xs text-grape-600 hover:text-grape-700 transition-colors">
          관리
        </Link>
      </div>

      {totalBudget != null && (
        <div className="mb-4 p-3 bg-[var(--surface-elevated)] rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--text-secondary)]">이번 달 총 예산</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{formatAmount(totalBudget)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--text-secondary)]">총 지출</span>
            <span className={`text-sm font-semibold ${totalSpent > totalBudget ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
              {formatAmount(totalSpent)}
            </span>
          </div>
          {totalUsage != null && (
            <div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--border-default)]">
                <div
                  className={`h-1.5 rounded-full transition-all ${totalUsage > 100 ? 'bg-red-500' : totalUsage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                  style={{ width: `${Math.min(totalUsage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-1 text-right">{totalUsage.toFixed(1)}% 사용</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((cat) => (
          <div key={cat.category_name}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <Link
                  to={monthStr ? `/?month=${monthStr}&category=${cat.category_name}` : `/?category=${cat.category_name}`}
                  className="text-sm font-medium text-[var(--text-primary)] hover:text-grape-600 transition-colors"
                >
                  {cat.category_name}
                </Link>
                {cat.is_exceeded && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">초과</span>
                )}
              </div>
              <div className="text-right">
                <span className={`text-sm font-semibold ${cat.is_exceeded ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                  {formatAmount(cat.spent_amount)}
                </span>
                <span className="text-xs text-[var(--text-muted)]"> / {formatAmount(cat.budget_amount)}</span>
              </div>
            </div>
            <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${cat.is_exceeded ? 'bg-red-500' : cat.usage_percentage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                style={{ width: `${Math.min(cat.usage_percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 text-right">{cat.usage_percentage.toFixed(1)}%</p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {expanded ? (
            <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>더보기 ({budgetStats.categories.length - maxItems}) <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  )
}
