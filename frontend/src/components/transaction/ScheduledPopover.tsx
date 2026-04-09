/**
 * @file ScheduledPopover.tsx
 * @description 달력에서 미래 날짜 클릭 시 예정된 정기거래 항목을 보여주는 팝오버
 */

import { useEffect, useRef } from 'react'
import { CalendarClock } from 'lucide-react'
import { formatAmount } from '../../utils/format'

interface ScheduledItem {
  id: number
  description: string
  amount: number
  type: 'expense' | 'income'
}

interface ScheduledPopoverProps {
  date: string // YYYY-MM-DD
  items: ScheduledItem[]
  onClose: () => void
}

/** 날짜에서 일(day) 부분만 추출하여 "N일 예정" 형태로 표시 */
function formatPopoverTitle(date: string): string {
  const day = parseInt(date.slice(8, 10), 10)
  return `${day}일 예정`
}

export default function ScheduledPopover({ date, items, onClose }: ScheduledPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  // 팝오버 바깥 클릭 또는 ESC로 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    // mousedown 대신 click 사용: mousedown은 React onClick보다 먼저 발동해
    // popoverDate를 null로 만든 뒤 onClick이 다시 열어버리는 버그가 생김
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (items.length === 0) return null

  return (
    <div
      ref={ref}
      data-testid="scheduled-popover"
      className="bg-[var(--surface-card)] rounded-xl shadow-lg border border-[var(--border-default)] p-3 mt-1 animate-fade-in"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <CalendarClock className="w-3.5 h-3.5 text-grape-400" />
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {formatPopoverTitle(date)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--text-primary)] truncate">
              {item.description}
            </span>
            <span
              className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                item.type === 'income' ? 'text-leaf-500' : 'text-grape-500'
              }`}
            >
              {item.type === 'income' ? '+' : ''}{formatAmount(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
