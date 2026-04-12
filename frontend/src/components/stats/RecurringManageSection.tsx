/**
 * @file RecurringManageSection.tsx
 * @description 모아보기 > 정기거래 섹션
 * 활성 정기거래 목록과 이번 달 상태(완료/건너뜀/예정/대기)를 표시한다.
 * 완료된 항목은 실제 실행 금액을 표시하고, 건너뜀 여부도 구분한다.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
  // next_due_date가 다음 달 이후 = 이번 달 통과
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
    case 'upcoming': {
      return null // 날짜는 금액 영역 아래에 별도 표시
    }
  }
}

export default function RecurringManageSection({ items, monthStr, executedAmountMap }: Props) {
  // 기본 접힌 상태 — 헤더에서 고정비 총액을 확인하고 필요 시 펼치는 패턴
  const [expanded, setExpanded] = useState(false)

  const monthlyExpenseTotal = items
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => {
      // 실제 실행 금액이 있으면 그걸 합산, 없으면 기본 금액
      const actual = executedAmountMap.get(r.id)
      return sum + (actual ?? r.amount)
    }, 0)

  if (items.length === 0) {
    return (
      <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">🔄 정기거래</h2>
          <Link to="/recurring" className="text-xs text-grape-600 hover:text-grape-700 transition-colors">
            관리
          </Link>
        </div>
        {/* 빈 상태: 고정비 등록 유도 CTA */}
        <p className="text-sm text-[var(--text-muted)] text-center py-2">
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
      {/* 헤더: 타이틀 + 고정비 총액 강조 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">🔄 정기거래</h2>
          {monthlyExpenseTotal > 0 && (
            <p className="text-xs text-[var(--text-muted)] leading-tight">
              이번 달 고정비{' '}
              <span className="font-medium text-[var(--text-secondary)]">{formatAmount(monthlyExpenseTotal)}</span>
            </p>
          )}
        </div>
        <Link to="/recurring" className="text-xs text-grape-600 hover:text-grape-700 transition-colors">
          관리
        </Link>
      </div>

      {/* 목록 (아코디언) */}
      {expanded && (
        <div className="mb-3">
          {items.map((item, idx) => {
            const isExpense = item.type === 'expense'
            const status = getItemStatus(item, monthStr, executedAmountMap)
            const executedAmount = executedAmountMap.get(item.id)
            // 완료된 항목은 실제 금액, 나머지는 기본 금액
            const displayAmount = executedAmount ?? item.amount
            const amountChanged = executedAmount != null && executedAmount !== item.amount

            // 예정일 표시 (upcoming일 때만)
            const [, month, day] = item.next_due_date.split('-').map(Number)

            // 건너뜀/대기는 흐리게
            const dimmed = status === 'skipped' || status === 'overdue'

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2.5 ${
                  idx < items.length - 1 ? 'border-b border-[var(--border-default)]' : ''
                } ${dimmed ? 'opacity-50' : ''}`}
              >
                {/* 이모지 + 설명 */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">
                    {item.category_emoji ?? (isExpense ? '💸' : '💰')}
                  </span>
                  <span className="text-sm text-[var(--text-primary)] truncate">{item.description}</span>
                </div>

                {/* 금액 + 상태 */}
                <div className="flex items-center gap-3 shrink-0 ml-2 text-right">
                  <div>
                    <span className={`text-sm font-medium ${isExpense ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
                      {formatAmount(displayAmount)}
                    </span>
                    {/* 금액이 수정된 경우 기본 금액을 작게 표시 */}
                    {amountChanged && (
                      <p className="text-xs text-[var(--text-muted)] line-through leading-none mt-0.5">
                        {formatAmount(item.amount)}
                      </p>
                    )}
                    {/* 예정일 */}
                    {status === 'upcoming' && (
                      <p className="text-xs text-[var(--text-tertiary)] leading-none mt-0.5">{month}/{day} 예정</p>
                    )}
                  </div>
                  <StatusBadge status={status} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 요약 푸터 + 접기/펼치기 */}
      <div className={`flex items-center justify-between pt-2 ${expanded ? 'border-t border-[var(--border-default)]' : ''}`}>
        <p className="text-xs text-[var(--text-muted)]">
          활성 {items.length}건
          {monthlyExpenseTotal > 0 && (
            <> · 이번 달 지출 <span className="font-medium text-[var(--text-secondary)]">{formatAmount(monthlyExpenseTotal)}</span></>
          )}
        </p>
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-0.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label={expanded ? '접기' : '펼치기'}
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> 접기</>
            : <><ChevronDown className="w-3.5 h-3.5" /> 펼치기</>
          }
        </button>
      </div>
    </div>
  )
}
