import { useState, useMemo } from 'react'
import { formatAmount, getLocalDateString } from '../../utils/format'
import type { RecurringTransaction } from '../../types'

interface TodayRecurringCardProps {
  items: RecurringTransaction[]
  onExecute: (id: number) => Promise<void>
  onSkip: (id: number) => Promise<void>
}

/** 오늘 기준 처리 대기 중인 정기거래를 카드 스택으로 보여주는 컴포넌트.
 *  한 번에 하나씩 표시하고, 등록/건너뛰기 후 다음 항목으로 이동한다.
 */
export default function TodayRecurringCard({ items, onExecute, onSkip }: TodayRecurringCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const today = useMemo(() => getLocalDateString(), [])

  // 오늘 또는 이전 날짜가 due_date인 정기거래만 필터링
  const pendingItems = useMemo(
    () => items.filter(r => r.next_due_date <= today),
    [items, today],
  )

  // 모든 항목을 처리했거나 대기 항목이 없으면 렌더링하지 않음
  if (pendingItems.length === 0 || currentIndex >= pendingItems.length) return null

  const current = pendingItems[currentIndex]
  const total = pendingItems.length
  const isExpense = current.type === 'expense'

  const handleAction = async (action: 'execute' | 'skip') => {
    setIsLoading(true)
    try {
      if (action === 'execute') {
        await onExecute(current.id)
      } else {
        await onSkip(current.id)
      }
      // 성공 시 다음 항목으로 이동
      setCurrentIndex(prev => prev + 1)
    } catch {
      // 실패 시 버튼 복원 (다음 항목으로 넘어가지 않음)
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
          {currentIndex + 1}/{total}
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
