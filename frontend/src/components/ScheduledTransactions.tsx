import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../utils/format'
import type { RecurringTransaction } from '../types'

interface ScheduledTransactionsProps {
  items: RecurringTransaction[]
  currentYear: number
  currentMonth: number // 0-indexed
  onExecute: (id: number) => void
  onSkip: (id: number) => void
}

const COLLAPSE_STORAGE_KEY = 'podo-scheduled-collapsed'

export default function ScheduledTransactions({
  items, currentYear, currentMonth, onExecute, onSkip,
}: ScheduledTransactionsProps) {
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const nextMonth = currentMonth === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`

  const scheduled = useMemo(
    () => items
      .filter(r => r.next_due_date >= monthStart && r.next_due_date < nextMonth)
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    [items, monthStart, nextMonth],
  )

  const today = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const hasPending = scheduled.some(r => r.next_due_date <= today)

  const [collapsed, setCollapsed] = useState(() => {
    if (!hasPending) return true
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
      if (stored) {
        const { date } = JSON.parse(stored)
        if (date === today) return true
      }
    } catch { /* 무시 */ }
    return false
  })

  const handleCollapse = () => {
    setCollapsed(true)
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify({ date: today }))
  }
  const handleExpand = () => setCollapsed(false)

  if (scheduled.length === 0) return null

  const hasExpense = scheduled.some(r => r.type === 'expense')
  const hasIncome = scheduled.some(r => r.type === 'income')
  const title = hasExpense && hasIncome
    ? '지출/수입 예정'
    : hasExpense ? '지출 예정' : '수입 예정'

  const totalExpense = scheduled.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const totalIncome = scheduled.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm overflow-hidden">
      <button
        onClick={collapsed ? handleExpand : handleCollapse}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="text-xs text-[var(--text-tertiary)]">{scheduled.length}건</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {hasExpense && hasIncome
              ? `지출 ${formatAmount(totalExpense)} · 수입 ${formatAmount(totalIncome)}`
              : formatAmount(hasExpense ? totalExpense : totalIncome)
            }
          </span>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
            : <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
          }
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="divide-y divide-[var(--border-subtle)]">
            {scheduled.map(r => {
              const isDue = r.next_due_date <= today
              const day = parseInt(r.next_due_date.slice(8, 10), 10)
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-[var(--text-tertiary)] w-6 shrink-0">{day}일</span>
                      <span className="text-sm text-[var(--text-primary)] truncate">{r.description}</span>
                    </div>
                    <span className={`text-sm font-medium shrink-0 ${
                      r.type === 'expense' ? 'text-[var(--text-secondary)]' : 'text-leaf-600'
                    }`}>
                      {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
                    </span>
                  </div>
                  {isDue && (
                    <div className="flex gap-2 mt-2 ml-8">
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
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)]">
            {totalExpense > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">남은 지출 {formatAmount(totalExpense)}</span>
            )}
            {totalExpense > 0 && totalIncome > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]"> · </span>
            )}
            {totalIncome > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">남은 수입 {formatAmount(totalIncome)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
