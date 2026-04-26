/**
 * @file RecurringManageSection.tsx
 * @description 모아보기 > 정기거래 섹션
 * 활성 정기거래 목록과 이번 달 상태(완료/건너뜀/예정/대기)를 표시한다.
 * 완료된 항목은 실제 실행 금액을 표시하고, 건너뜀 여부도 구분한다.
 * 접힌 상태: 완료/예정/수입 칩 오버뷰
 * 펼친 상태: 항목별 상세 목록
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import SectionHeader from './SectionHeader'
import { formatAmount } from '../../utils/format'
import type { RecurringTransaction } from '../../types'

type Props = {
  items: RecurringTransaction[]
  monthStr: string // "YYYY-MM"
  executedAmountMap: Map<number, number> // recurring_transaction_id → 실제 실행 금액
}

/** next_due_date와 monthStr 비교로 이번 달 처리 여부 도출 */
function isDone(nextDueDate: string, monthStr: string): boolean {
  return nextDueDate.slice(0, 7) > monthStr
}

type ItemStatus = 'executed' | 'skipped' | 'upcoming' | 'overdue'

function getItemStatus(item: RecurringTransaction, monthStr: string, executedAmountMap: Map<number, number>): ItemStatus {
  if (!isDone(item.next_due_date, monthStr)) {
    const dueMonth = item.next_due_date.slice(0, 7)
    return dueMonth < monthStr ? 'overdue' : 'upcoming'
  }
  return executedAmountMap.has(item.id) ? 'executed' : 'skipped'
}

function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'executed':
      return <span className="text-xs text-[var(--text-tertiary)]">✓ 완료</span>
    case 'skipped':
      return <span className="text-xs text-[var(--text-muted)]">건너뜀</span>
    case 'overdue':
      return <span className="text-xs text-[var(--text-muted)]">대기 중</span>
    case 'upcoming':
      return null
  }
}

/** 접힌 상태 오버뷰 칩 — 완료/예정/수입 요약 */
function OverviewChips({
  items,
  monthStr,
  executedAmountMap,
}: {
  items: RecurringTransaction[]
  monthStr: string
  executedAmountMap: Map<number, number>
}) {
  const statusCounts = { executed: 0, upcoming: 0, overdue: 0 }
  items.forEach(item => {
    const s = getItemStatus(item, monthStr, executedAmountMap)
    if (s === 'executed') statusCounts.executed++
    else if (s === 'upcoming') statusCounts.upcoming++
    else if (s === 'overdue') statusCounts.overdue++
  })

  // 정기 수입 합계 (지출과 분리해서 표시)
  const incomeTotal = items
    .filter(r => r.type === 'income')
    .reduce((sum, r) => {
      const actual = executedAmountMap.get(r.id)
      return sum + (actual ?? r.amount)
    }, 0)

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {statusCounts.executed > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-leaf-50 text-leaf-700 border border-leaf-200">
          ✓ 완료 {statusCounts.executed}건
        </span>
      )}
      {statusCounts.overdue > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          ⚠️ 미처리 {statusCounts.overdue}건
        </span>
      )}
      {statusCounts.upcoming > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]">
          📅 예정 {statusCounts.upcoming}건
        </span>
      )}
      {incomeTotal > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-leaf-50 text-leaf-700 border border-leaf-200">
          수입 {formatAmount(incomeTotal)}
        </span>
      )}
    </div>
  )
}

export default function RecurringManageSection({ items, monthStr, executedAmountMap }: Props) {
  const [expanded, setExpanded] = useState(false)

  const monthlyExpenseTotal = items
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => {
      const actual = executedAmountMap.get(r.id)
      return sum + (actual ?? r.amount)
    }, 0)

  if (items.length === 0) {
    return (
      <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
        <SectionHeader icon="🔄" title="정기거래" manageTo="/recurring" expanded={false} collapsible={false} />
        <p className="text-sm text-[var(--text-muted)] text-center py-2 mt-3">
          정기거래를 등록하면 고정비 현황을 볼 수 있어요
        </p>
        <div className="text-center mt-2">
          <Link
            to="/recurring"
            className="text-xs text-grape-600 hover:text-grape-700 font-medium transition-colors"
          >
            등록하기 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      {/* 헤더: 타이틀 + chevron 토글 + 고정비 총액 서브텍스트 */}
      <SectionHeader
        icon="🔄"
        title="정기거래"
        manageTo="/recurring"
        expanded={expanded}
        onToggle={() => setExpanded(prev => !prev)}
      >
        {monthlyExpenseTotal > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">
            이번 달 고정비{' '}
            <span className="font-medium text-[var(--text-secondary)]">{formatAmount(monthlyExpenseTotal)}</span>
          </p>
        )}
      </SectionHeader>

      {/* 접힌 상태: 상태 칩 오버뷰 */}
      {!expanded && (
        <div className="mt-3">
          <OverviewChips items={items} monthStr={monthStr} executedAmountMap={executedAmountMap} />
        </div>
      )}

      {/* 펼침: 항목별 상세 목록 — 지출 먼저, 수입 나중 정렬 */}
      {expanded && (
        <div className="mt-3">
          {[...items]
            .sort((a, b) => {
              if (a.type === b.type) return 0
              return a.type === 'expense' ? -1 : 1
            })
            .map((item, idx, sorted) => {
            const isExpense = item.type === 'expense'
            const isFirstIncome = item.type === 'income' && sorted[idx - 1]?.type === 'expense'
            const status = getItemStatus(item, monthStr, executedAmountMap)
            const executedAmount = executedAmountMap.get(item.id)
            const displayAmount = executedAmount ?? item.amount
            const amountChanged = executedAmount != null && executedAmount !== item.amount
            const [, month, day] = item.next_due_date.split('-').map(Number)
            const dimmed = status === 'skipped' || status === 'overdue'

            return (
              <div key={item.id}>
                {/* 수입 그룹 구분선 */}
                {isFirstIncome && (
                  <div className="flex items-center gap-2 py-2 mt-1">
                    <div className="flex-1 h-px bg-[var(--border-default)]" />
                    <span className="text-xs text-[var(--text-muted)]">수입</span>
                    <div className="flex-1 h-px bg-[var(--border-default)]" />
                  </div>
                )}
              <div
                className={`flex items-center justify-between py-2.5 ${
                  idx < sorted.length - 1 && !(sorted[idx + 1]?.type === 'income' && isExpense)
                    ? 'border-b border-[var(--border-default)]'
                    : ''
                } ${dimmed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">
                    {item.category_emoji ?? (isExpense ? '💸' : '💰')}
                  </span>
                  <span className="text-sm text-[var(--text-primary)] truncate">{item.description}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2 text-right">
                  <div>
                    <span className={`text-sm font-medium tabular-nums ${isExpense ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
                      {formatAmount(displayAmount)}
                    </span>
                    {amountChanged && (
                      <p className="text-xs text-[var(--text-muted)] line-through leading-none mt-0.5">
                        {formatAmount(item.amount)}
                      </p>
                    )}
                    {status === 'upcoming' && (
                      <p className="text-xs text-[var(--text-tertiary)] leading-none mt-0.5">{month}/{day} 예정</p>
                    )}
                  </div>
                  <StatusBadge status={status} />
                </div>
              </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
