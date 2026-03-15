import type { CategoryStats } from '../../types'
import { formatAmount } from '../../utils/format'

interface CategoryTopListProps {
  categories: CategoryStats[]
  maxItems?: number
}

export default function CategoryTopList({ categories, maxItems = 5 }: CategoryTopListProps) {
  if (categories.length === 0) return null

  const top = categories.slice(0, maxItems)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">지출 카테고리 TOP</h3>
      <div className="space-y-2.5">
        {top.map((cat, i) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-muted)] w-4">{i + 1}</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{cat.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">{formatAmount(cat.amount)}</span>
                <span className="text-xs text-[var(--text-tertiary)] w-12 text-right">{cat.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden ml-6">
              <div className="h-full rounded-full bg-grape-500" style={{ width: `${cat.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
