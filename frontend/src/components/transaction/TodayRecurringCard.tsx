import { useState, useMemo, useEffect } from 'react'
import { formatAmount, getLocalDateString } from '../../utils/format'
import type { RecurringTransaction } from '../../types'

interface TodayRecurringCardProps {
  items: RecurringTransaction[]
  onExecute: (id: number) => Promise<void>
  onSkip: (id: number) => Promise<void>
}

/** 오늘 기준 처리 대기 중인 정기거래를 카드 스택으로 보여주는 컴포넌트.
 *  한 번에 하나씩 표시하고, 등록/건너뛰기 후 다음 항목으로 이동한다.
 *  processedIds로 처리 상태를 추적하여 items 참조가 바뀌어도 안전하게 동작한다.
 */
export default function TodayRecurringCard({ items, onExecute, onSkip }: TodayRecurringCardProps) {
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  // items 참조가 바뀌면 (refetch 후) processedIds 클리어 — 실행된 건은 이미 next_due_date가 다음 달로 이동해 pendingItems에서 제외됨
  useEffect(() => {
    setProcessedIds(new Set())
  }, [items])

  const today = getLocalDateString()

  // 오늘 또는 이전 날짜가 due_date이고 아직 처리하지 않은 정기거래만 필터링
  const visibleItems = useMemo(
    () => items.filter(r => r.next_due_date <= today && !processedIds.has(r.id)),
    [items, today, processedIds],
  )

  // 처리할 항목이 없으면 렌더링하지 않음
  if (visibleItems.length === 0) return null

  const current = visibleItems[0]
  const total = visibleItems.length
  const isExpense = current.type === 'expense'

  const handleAction = async (action: 'execute' | 'skip') => {
    setIsLoading(true)
    try {
      if (action === 'execute') {
        await onExecute(current.id)
      } else {
        await onSkip(current.id)
      }
      // 성공 시 처리된 ID 추가 → visibleItems에서 자동으로 제외
      setProcessedIds(prev => new Set(prev).add(current.id))
    } catch {
      // 실패 시 버튼 복원 (처리 상태 변경 없음)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-4">
      {/* 헤더 */}
      <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        📅 오늘 정기거래 {total}건
      </div>

      {/* 카드 본문 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* 지출/수입 아이콘 */}
          <span className="text-lg">{isExpense ? '💸' : '💰'}</span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {current.description}
          </span>
          <span className={`text-sm font-semibold shrink-0 ${isExpense ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
            {formatAmount(current.amount)}
          </span>
        </div>

        {/* 순번 표시 (N/M) */}
        <span className="text-xs text-[var(--text-tertiary)] shrink-0 ml-2">
          1/{total}
        </span>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('execute')}
          disabled={isLoading}
          className={`flex-1 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isExpense
              ? 'bg-grape-600 hover:bg-grape-700'
              : 'bg-leaf-600 hover:bg-leaf-700'
          }`}
        >
          등록하기
        </button>
        <button
          onClick={() => handleAction('skip')}
          disabled={isLoading}
          className="flex-1 py-2 rounded-xl text-sm font-medium bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          건너뛰기
        </button>
      </div>
    </div>
  )
}
