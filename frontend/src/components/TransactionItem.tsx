/**
 * @file TransactionItem.tsx
 * @description 2줄 구조 거래 항목 — 설명+금액 / 카테고리뱃지
 */

import { Link } from 'react-router-dom'
import { formatAmount } from '../utils/format'
import type { Category } from '../types'

interface TransactionItemProps {
  id: number
  type: 'expense' | 'income'
  description: string
  amount: number
  categoryId: number | null
  categories: Category[]
  excludeFromStats?: boolean
  rawInput?: string | null
  onCategoryClick: (e: React.MouseEvent) => void
}

export default function TransactionItem({
  id,
  type,
  description,
  amount,
  categoryId,
  categories,
  excludeFromStats,
  rawInput,
  onCategoryClick,
}: TransactionItemProps) {
  const category = categoryId != null ? categories.find(c => c.id === categoryId) : null
  const detailPath = type === 'expense' ? `/expenses/${id}` : `/income/${id}`
  const isRecurring = rawInput?.startsWith('[정기]')

  return (
    <Link
      to={detailPath}
      className={`flex flex-col gap-1 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors ${
        excludeFromStats ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
          {description}
        </span>
        <span
          className={`text-sm font-semibold whitespace-nowrap ${
            type === 'income' ? 'text-leaf-600' : 'text-[var(--text-primary)]'
          }`}
        >
          {type === 'expense' ? '-' : '+'}{formatAmount(amount)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onCategoryClick(e)
          }}
          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
            type === 'income'
              ? 'bg-leaf-50 text-leaf-600 hover:bg-leaf-100'
              : 'bg-grape-50 text-grape-600 hover:bg-grape-100'
          }`}
        >
          {category?.name ?? '미분류'}
        </button>
        {isRecurring && (
          <span className="text-xs bg-[var(--border-default)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">정기</span>
        )}
        {excludeFromStats && (
          <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-full">통계제외</span>
        )}
      </div>
    </Link>
  )
}
