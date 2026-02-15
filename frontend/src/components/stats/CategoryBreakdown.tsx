/**
 * @file CategoryBreakdown.tsx
 * @description 카테고리별 지출 프로그레스바 + 전기 대비 변화량
 */

import ChangeIndicator from './ChangeIndicator'
import type { CategoryStats, CategoryChange } from '../../types'

interface CategoryBreakdownProps {
  categories: CategoryStats[]
  comparisons?: CategoryChange[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function CategoryBreakdown({ categories, comparisons = [] }: CategoryBreakdownProps) {
  const compMap = new Map(comparisons.map((c) => [c.category, c]))

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-stone-700 mb-4">카테고리별 지출</h3>
        <p className="text-sm text-stone-400 text-center py-4">데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-stone-700 mb-4">카테고리별 지출</h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const comp = compMap.get(cat.category)
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">{formatAmount(cat.amount)}</span>
                  {comp && <ChangeIndicator percentage={comp.change_percentage} compact />}
                </div>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all"
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
              <div className="text-xs text-stone-400 text-right">{cat.percentage}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
