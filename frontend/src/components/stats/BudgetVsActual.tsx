/**
 * @file BudgetVsActual.tsx
 * @description 월간 예산 대비 지출 현황 — props 방식 (데이터는 InsightsPage에서 주입)
 */

import { Wallet } from 'lucide-react'
import type { BudgetMonthlyStatsResponse } from '../../types'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

interface BudgetVsActualProps {
  budgetStats: BudgetMonthlyStatsResponse | null
}

export default function BudgetVsActual({ budgetStats }: BudgetVsActualProps) {
  if (!budgetStats || budgetStats.categories.length === 0) return null

  const totalBudget = budgetStats.total_budget
  const totalSpent = budgetStats.total_spent
  const totalUsage = totalBudget && totalBudget > 0 ? (totalSpent / totalBudget) * 100 : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-4 sm:p-6" data-testid="budget-vs-actual">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-grape-600" />
        <h2 className="text-base font-semibold text-warm-900">예산 현황</h2>
      </div>

      {totalBudget != null && (
        <div className="mb-4 p-3 bg-warm-50 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-warm-600">이번 달 총 예산</span>
            <span className="text-sm font-semibold text-warm-900">{formatAmount(totalBudget)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-warm-600">총 지출</span>
            <span className={`text-sm font-semibold ${totalSpent > totalBudget ? 'text-red-600' : 'text-warm-900'}`}>
              {formatAmount(totalSpent)}
            </span>
          </div>
          {totalUsage != null && (
            <div>
              <div className="w-full bg-warm-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${totalUsage > 100 ? 'bg-red-500' : totalUsage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                  style={{ width: `${Math.min(totalUsage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-warm-500 mt-1 text-right">{totalUsage.toFixed(1)}% 사용</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {budgetStats.categories.map((cat) => (
          <div key={cat.category_name}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-warm-800">{cat.category_name}</span>
                {cat.is_exceeded && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">초과</span>
                )}
              </div>
              <div className="text-right">
                <span className={`text-sm font-semibold ${cat.is_exceeded ? 'text-red-600' : 'text-warm-900'}`}>
                  {formatAmount(cat.spent_amount)}
                </span>
                <span className="text-xs text-warm-400"> / {formatAmount(cat.budget_amount)}</span>
              </div>
            </div>
            <div className="w-full bg-warm-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${cat.is_exceeded ? 'bg-red-500' : cat.usage_percentage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                style={{ width: `${Math.min(cat.usage_percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-warm-400 mt-0.5 text-right">{cat.usage_percentage.toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
