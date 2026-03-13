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
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
      <h3 className="text-sm font-semibold text-warm-700 mb-3">지출 카테고리 TOP</h3>
      <div className="space-y-2.5">
        {top.map((cat, i) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-warm-400 w-4">{i + 1}</span>
                <span className="text-sm font-medium text-warm-800">{cat.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-warm-700">{formatAmount(cat.amount)}</span>
                <span className="text-xs text-warm-500 w-12 text-right">{cat.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden ml-6">
              <div className="h-full rounded-full bg-grape-500" style={{ width: `${cat.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
