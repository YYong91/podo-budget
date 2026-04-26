/**
 * @file BudgetVsActual.tsx
 * @description 월간 예산 대비 지출 상황 — 접기/펼치기 구조
 * 접힌 상태: 총예산/총지출 오버뷰 + 단일 프로그레스바 + 초과 배지
 * 펼친 상태: 전체 카테고리 목록
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BudgetMonthlyStatsResponse } from '../../types'
import { formatAmount } from '../../utils/format'
import SectionHeader from './SectionHeader'

interface BudgetVsActualProps {
  budgetStats: BudgetMonthlyStatsResponse | null
  monthStr?: string
}

export default function BudgetVsActual({ budgetStats, monthStr }: BudgetVsActualProps) {
  const [expanded, setExpanded] = useState(false)

  if (!budgetStats || budgetStats.categories.length === 0) return null

  const { total_budget, total_spent, categories } = budgetStats
  const totalUsage = total_budget && total_budget > 0 ? (total_spent / total_budget) * 100 : null
  const exceededCount = categories.filter(c => c.is_exceeded).length

  return (
    <div
      className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6"
      data-testid="budget-vs-actual"
    >
      <SectionHeader
        icon="💰"
        title="예산 상황"
        manageTo="/budgets"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
      />

      {/* 오버뷰: 총예산/총지출 + 프로그레스바 */}
      <div className="mt-3">
        {total_budget != null && total_budget > 0 ? (
          <>
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  {formatAmount(total_spent)}
                  <span className="text-[var(--text-muted)]"> / {formatAmount(total_budget)}</span>
                </span>
                {exceededCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                    ⚠ {exceededCount}개 초과
                  </span>
                )}
              </div>
              {totalUsage != null && (
                <span className="text-xs text-[var(--text-muted)]">{totalUsage.toFixed(1)}%</span>
              )}
            </div>
            {totalUsage != null && (
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--border-default)]">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    totalUsage > 100 ? 'bg-red-500' : totalUsage >= 80 ? 'bg-amber-500' : 'bg-grape-500'
                  }`}
                  style={{ width: `${Math.min(totalUsage, 100)}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 mt-3">
            <p className="text-sm text-[var(--text-tertiary)]">예산이 설정되지 않았습니다</p>
            <Link
              to="/budgets"
              className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block"
            >
              설정하기 →
            </Link>
          </div>
        )}
      </div>

      {/* 펼침: 전체 카테고리 목록 */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {categories.map((cat) => (
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
                  className={`h-1.5 rounded-full transition-all ${
                    cat.is_exceeded ? 'bg-red-500' : cat.usage_percentage >= 80 ? 'bg-amber-500' : 'bg-grape-500'
                  }`}
                  style={{ width: `${Math.min(cat.usage_percentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 text-right">{cat.usage_percentage.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
