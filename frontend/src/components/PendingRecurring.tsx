/* 반복 거래 알림 카드 — Dashboard에서 추출한 독립 컴포넌트 */

import type { RecurringTransaction } from '../types'
import { formatAmount } from '../utils/format'

interface PendingRecurringProps {
  items: RecurringTransaction[]
  onExecute: (id: number) => void
  onSkip: (id: number) => void
}

export default function PendingRecurring({ items, onExecute, onSkip }: PendingRecurringProps) {
  if (items.length === 0) return null

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      <h2 className="text-base font-semibold text-[var(--text-secondary)] mb-3">오늘의 반복 거래</h2>
      <div className="space-y-3">
        {items.map((r) => (
          <div
            key={r.id}
            className={`flex items-center justify-between p-3 rounded-xl border-l-4 ${
              r.type === 'expense'
                ? 'border-l-grape-400 bg-grape-50/50'
                : 'border-l-leaf-400 bg-leaf-50/50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--text-primary)] truncate">{r.description}</p>
              <p className={`text-sm font-semibold ${r.type === 'expense' ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
                {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
              </p>
            </div>
            <div className="flex gap-2 ml-3">
              <button
                onClick={() => onExecute(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${
                  r.type === 'expense'
                    ? 'bg-grape-600 hover:bg-grape-700'
                    : 'bg-leaf-600 hover:bg-leaf-700'
                } transition-colors`}
              >
                등록
              </button>
              <button
                onClick={() => onSkip(r.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                건너뛰기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
