/**
 * @file TransactionItem.tsx
 * @description 2줄 구조 거래 항목 — 설명+금액 / 카테고리뱃지
 */

import { memo } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount } from '../utils/format'
import type { Category } from '../types'

interface TransactionItemProps {
  id: number
  type: 'expense' | 'income'
  description: string
  amount: number
  categoryId: number | null
  /** O(1) 카테고리 조회를 위해 Map으로 전달 (#180) */
  categoryMap: Map<number, Category>
  excludeFromStats?: boolean
  rawInput?: string | null
  /** 안정적 콜백 — TransactionList에서 useMemo로 생성된 핸들러 전달 (#240) */
  onCategoryClick: () => void
}

function TransactionItem({
  id,
  type,
  description,
  amount,
  categoryId,
  categoryMap,
  excludeFromStats,
  rawInput,
  onCategoryClick,
}: TransactionItemProps) {
  // O(1) 조회 — 이전 O(n) find 대비 300건×20카테고리=6,000비교 → 300번 해시 조회 (#180)
  const category = categoryId != null ? categoryMap.get(categoryId) : null
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
            onCategoryClick()
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

// React.memo로 불필요한 리렌더 방지 — onCategoryClick은 TransactionList에서 useMemo로 안정화 (#240)
export default memo(TransactionItem)
