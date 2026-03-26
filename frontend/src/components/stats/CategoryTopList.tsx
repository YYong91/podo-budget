import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CategoryStats } from '../../types'
import { formatAmount } from '../../utils/format'

interface CategoryTopListProps {
  categories: CategoryStats[]
  maxItems?: number
  monthStr?: string
}

export default function CategoryTopList({ categories, maxItems = 5, monthStr }: CategoryTopListProps) {
  const [expanded, setExpanded] = useState(false)
  if (categories.length === 0) return null

  const hasMore = categories.length > maxItems
  const visible = expanded ? categories : categories.slice(0, maxItems)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">지출 카테고리 TOP</h3>
      <div className="space-y-2.5">
        {visible.map((cat, i) => {
          const href = monthStr
            ? `/?month=${monthStr}&category=${cat.category}`
            : `/?category=${cat.category}`

          return (
            <Link key={cat.category} to={href} className="block hover:bg-[var(--surface-hover)] -mx-2 px-2 py-1 rounded-lg transition-colors">
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
            </Link>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {expanded ? (
            <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>더보기 ({categories.length - maxItems}) <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  )
}
