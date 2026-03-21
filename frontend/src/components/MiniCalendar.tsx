/**
 * @file MiniCalendar.tsx
 * @description 미니 캘린더 — 날짜별 지출/수입 금액 표시, 날짜 탭 시 콜백
 */

import { memo, useMemo } from 'react'
import { getCalendarGrid } from '../utils/calendar'
import { formatCompactAmount } from '../utils/format'

interface DaySummary {
  expense: number
  income: number
}

interface MiniCalendarProps {
  year: number
  month: number // 0-indexed
  daySummaries: Map<string, DaySummary>
  onDateClick: (dateString: string) => void
  today: string // YYYY-MM-DD
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function MiniCalendar({
  year,
  month,
  daySummaries,
  onDateClick,
  today,
}: MiniCalendarProps) {
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-warm-400'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      {grid.map((week, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-7">
          {week.map((day, colIdx) => {
            if (!day) {
              return <div key={colIdx} className="py-1" />
            }

            const summary = daySummaries.get(day.dateString)
            const isToday = day.dateString === today
            const isWeekend = colIdx === 0 || colIdx === 6

            return (
              <button
                key={colIdx}
                onClick={() => onDateClick(day.dateString)}
                className="flex flex-col items-center py-1 px-0.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors min-h-[48px]"
              >
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-grape-600 text-white font-bold'
                      : isWeekend
                        ? colIdx === 0 ? 'text-red-400' : 'text-blue-400'
                        : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {day.date}
                </span>
                {summary && (
                  <div className="flex flex-col items-center mt-0.5">
                    {summary.expense > 0 && (
                      <span className="text-[9px] leading-tight text-grape-500">
                        -{formatCompactAmount(summary.expense)}
                      </span>
                    )}
                    {summary.income > 0 && (
                      <span className="text-[9px] leading-tight text-leaf-500">
                        +{formatCompactAmount(summary.income)}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// React.memo로 year/month/daySummaries/today 변경 시에만 리렌더 (#240)
export default memo(MiniCalendar)
