/**
 * @file MiniCalendar.tsx
 * @description 미니 캘린더 — 날짜별 도트 인디케이터 표시, 주간 스트립 모드 지원
 */

import { memo, useMemo } from 'react'
import { getCalendarGrid } from '../utils/calendar'

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
  weekOnly?: boolean
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function MiniCalendar({
  year,
  month,
  daySummaries,
  onDateClick,
  today,
  weekOnly = false,
}: MiniCalendarProps) {
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  const visibleWeeks = useMemo(() => {
    if (!weekOnly) return grid

    // today가 이 달에 있으면 해당 주 표시
    const todayWeek = grid.find((week) => week.some((day) => day?.dateString === today))
    if (todayWeek) return [todayWeek]

    // today가 없는 달(이전달/다음달) → 시간적으로 오늘에 가까운 쪽 끝 주 표시
    // 이전달: 마지막 유효 주 / 다음달: 첫 번째 유효 주
    const validWeeks = grid.filter((week) => week.some((day) => day !== null))
    const todayDate = new Date(today)
    const isPastMonth = new Date(year, month + 1, 0) < todayDate // 해당 달 말일 < 오늘
    return isPastMonth ? [validWeeks.at(-1)!] : [validWeeks[0]]
  }, [weekOnly, grid, today, year, month])

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-[10px] font-normal py-1 ${
              i === 0 ? 'text-red-300' : i === 6 ? 'text-[var(--text-muted)]' : 'text-warm-400'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      {visibleWeeks.map((week, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-7" data-testid="calendar-week">
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
                data-date={day.dateString}
                onClick={() => onDateClick(day.dateString)}
                className="flex flex-col items-center py-1 px-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors min-h-[40px]"
              >
                <span
                  className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-grape-600 text-white font-semibold'
                      : isWeekend
                        ? colIdx === 0 ? 'text-red-300' : 'text-[var(--text-muted)]'
                        : 'text-[var(--text-primary)] font-normal'
                  }`}
                >
                  {day.date}
                </span>
                {summary && (summary.expense > 0 || summary.income > 0) && (
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    {summary.expense > 0 && (
                      <div data-testid="dot" className="w-1.5 h-1.5 rounded-full bg-grape-400" />
                    )}
                    {summary.income > 0 && (
                      <div data-testid="dot" className="w-1.5 h-1.5 rounded-full bg-leaf-400" />
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
