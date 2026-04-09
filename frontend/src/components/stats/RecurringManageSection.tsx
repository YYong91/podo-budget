/**
 * @file RecurringManageSection.tsx
 * @description 모아보기 > 정기거래 섹션
 * 활성 정기거래 목록과 이번 달 처리 상태(처리됨/예정/대기)를 표시한다.
 * 아코디언으로 접고 펼칠 수 있으며, 관리 페이지 링크를 제공한다.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { RecurringTransaction } from '../../types'

type Props = {
  items: RecurringTransaction[]
  monthStr: string // "YYYY-MM"
}

/** next_due_date와 monthStr 비교로 이번 달 처리 상태 도출 */
function getStatus(nextDueDate: string, monthStr: string): 'done' | 'upcoming' | 'pending' {
  const dueMonth = nextDueDate.slice(0, 7) // "YYYY-MM"
  if (dueMonth > monthStr) return 'done'
  if (dueMonth === monthStr) return 'upcoming'
  return 'pending' // next_due_date가 이번 달보다 이전 — 오래된 미처리
}

function StatusBadge({ nextDueDate, monthStr }: { nextDueDate: string; monthStr: string }) {
  const status = getStatus(nextDueDate, monthStr)
  const [, month, day] = nextDueDate.split('-').map(Number)

  if (status === 'done') {
    return <span className="text-xs font-medium text-leaf-600">✓ 처리됨</span>
  }
  if (status === 'pending') {
    return <span className="text-xs font-medium text-[var(--text-muted)]">대기 중</span>
  }
  // upcoming
  return <span className="text-xs text-[var(--text-tertiary)]">{month}/{day} 예정</span>
}

export default function RecurringManageSection({ items, monthStr }: Props) {
  const [expanded, setExpanded] = useState(true)

  if (items.length === 0) {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-grape-600" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">정기거래</h2>
          </div>
          <Link
            to="/recurring"
            className="text-xs text-grape-600 hover:text-grape-700 transition-colors"
          >
            관리 →
          </Link>
        </div>
        <p className="text-sm text-[var(--text-muted)] text-center py-2">등록된 정기거래가 없습니다</p>
      </div>
    )
  }

  const monthlyExpenseTotal = items
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-grape-600" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">정기거래</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/recurring"
            className="text-xs text-grape-600 hover:text-grape-700 transition-colors"
          >
            관리 →
          </Link>
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label={expanded ? '접기' : '펼치기'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 목록 (아코디언) */}
      {expanded && (
        <div className="space-y-0">
          {items.map((item, idx) => {
            const isExpense = item.type === 'expense'
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2.5 ${
                  idx < items.length - 1 ? 'border-b border-[var(--border-default)]' : ''
                }`}
              >
                {/* 이모지 + 설명 */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">
                    {item.category_emoji ?? (isExpense ? '💸' : '💰')}
                  </span>
                  <span className="text-sm text-[var(--text-primary)] truncate">{item.description}</span>
                </div>

                {/* 금액 + 상태 */}
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className={`text-sm font-medium ${isExpense ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
                    {formatAmount(item.amount)}
                  </span>
                  <StatusBadge nextDueDate={item.next_due_date} monthStr={monthStr} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 요약 푸터 */}
      <p className={`text-xs text-[var(--text-muted)] ${expanded ? 'mt-3 pt-3 border-t border-[var(--border-default)]' : ''}`}>
        활성 {items.length}건
        {monthlyExpenseTotal > 0 && (
          <> · 이번 달 지출 <span className="font-medium text-[var(--text-secondary)]">{formatAmount(monthlyExpenseTotal)}</span></>
        )}
      </p>
    </div>
  )
}
