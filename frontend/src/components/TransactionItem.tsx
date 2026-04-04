/**
 * @file TransactionItem.tsx
 * @description 아이콘 원 + 2줄 텍스트 구조 거래 항목 — 이모지 아이콘 / 설명+금액 / 카테고리+뱃지
 */

import { memo } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount } from '../utils/format'
import type { Category } from '../types'

// 시스템 카테고리 이름 → 배경색 (light + dark)
const CATEGORY_COLORS: Record<string, string> = {
  '식비': 'bg-orange-100 dark:bg-orange-900/30',
  '카페/음료': 'bg-amber-100 dark:bg-amber-900/30',
  '교통': 'bg-blue-100 dark:bg-blue-900/30',
  '주거/관리비': 'bg-stone-200 dark:bg-stone-800/30',
  '통신': 'bg-sky-100 dark:bg-sky-900/30',
  '생활용품': 'bg-teal-100 dark:bg-teal-900/30',
  '의류/미용': 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
  '의료/건강': 'bg-rose-100 dark:bg-rose-900/30',
  '교육/자기계발': 'bg-indigo-100 dark:bg-indigo-900/30',
  '문화/여가': 'bg-purple-100 dark:bg-purple-900/30',
  '경조사': 'bg-red-100 dark:bg-red-900/30',
  '자녀/육아': 'bg-pink-100 dark:bg-pink-900/30',
  '반려동물': 'bg-yellow-100 dark:bg-yellow-900/30',
  '보험': 'bg-slate-100 dark:bg-slate-800/30',
  '대출/이자': 'bg-zinc-100 dark:bg-zinc-800/30',
  '세금/공과금': 'bg-neutral-100 dark:bg-neutral-800/30',
  '구독': 'bg-violet-100 dark:bg-violet-900/30',
  '기타': 'bg-gray-100 dark:bg-gray-800/30',
}

function getCategoryBgColor(categoryName: string | undefined, type: 'expense' | 'income'): string {
  if (type === 'income') return 'bg-leaf-100'
  if (!categoryName) return 'bg-grape-100'
  return CATEGORY_COLORS[categoryName] ?? 'bg-grape-100'
}

interface TransactionItemProps {
  id: number
  type: 'expense' | 'income'
  description: string
  amount: number
  categoryId: number | null
  /** O(1) 카테고리 조회를 위해 Map으로 전달 (#180) */
  categoryMap: Map<number, Category>
  excludeFromStats?: boolean
  recurringTransactionId?: number | null
  /** 안정적 콜백 — TransactionList에서 useMemo로 생성된 핸들러 전달 (#240) */
  onCategoryClick: () => void
  /** 기록자 username — 가구원 2명 이상일 때만 전달 (#522) */
  recordedBy?: string
}

function TransactionItem({
  id,
  type,
  description,
  amount,
  categoryId,
  categoryMap,
  excludeFromStats,
  recurringTransactionId,
  onCategoryClick,
  recordedBy,
}: TransactionItemProps) {
  // O(1) 조회 — 이전 O(n) find 대비 300건×20카테고리=6,000비교 → 300번 해시 조회 (#180)
  const category = categoryId != null ? categoryMap.get(categoryId) : null
  const detailPath = type === 'expense' ? `/expenses/${id}` : `/income/${id}`
  // FK 기반 정기거래 감지 — 이전 raw_input '[정기]' 접두사 방식 대체
  const isRecurring = recurringTransactionId != null

  return (
    <Link
      to={detailPath}
      className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--surface-hover)] transition-colors ${
        excludeFromStats ? 'opacity-50' : ''
      }`}
    >
      {/* 왼쪽 아이콘 원 — 카테고리 변경 트리거 */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onCategoryClick()
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80 ${getCategoryBgColor(category?.name, type)}`}
        aria-label="카테고리 변경"
      >
        <span className="text-lg">{category?.emoji ?? '📌'}</span>
      </button>

      {/* 오른쪽 텍스트 영역 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-medium text-[var(--text-primary)] truncate">
            {description}
          </span>
          <span
            className={`text-amount whitespace-nowrap ${
              type === 'income' ? 'text-leaf-600' : 'text-[var(--text-primary)]'
            }`}
          >
            {type === 'expense' ? '-' : '+'}{formatAmount(amount)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-[var(--text-muted)]">
            {category?.name ?? '분류 안 됨'}
          </span>
          {isRecurring && (
            <span className="text-xs bg-[var(--border-default)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">정기</span>
          )}
          {excludeFromStats && (
            <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-full">통계제외</span>
          )}
          {recordedBy && (
            <span className="text-xs text-[var(--text-tertiary)]">{recordedBy}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// React.memo로 불필요한 리렌더 방지 — onCategoryClick은 TransactionList에서 useMemo로 안정화 (#240)
export default memo(TransactionItem)
