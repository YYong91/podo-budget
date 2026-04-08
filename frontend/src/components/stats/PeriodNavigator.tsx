/**
 * @file PeriodNavigator.tsx
 * @description ◀ 기간 ▶ 네비게이션 컴포넌트
 * onMonthSelect 제공 시 라벨이 버튼이 되어 MonthPicker 팝업을 열 수 있음
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import MonthPicker from './MonthPicker'

interface PeriodNavigatorProps {
  label: string
  onPrev: () => void
  onNext: () => void
  // MonthPicker 연동 — 없으면 라벨이 텍스트로만 표시됨
  currentYear?: number
  currentMonth?: number  // 0-indexed
  onMonthSelect?: (year: number, month: number) => void
}

export default function PeriodNavigator({
  label, onPrev, onNext,
  currentYear, currentMonth, onMonthSelect,
}: PeriodNavigatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 / Escape 키 시 팝업 닫기
  useEffect(() => {
    if (!pickerOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  const hasMonthPicker = onMonthSelect !== undefined && currentYear !== undefined && currentMonth !== undefined

  return (
    <div ref={containerRef} className="relative flex items-center justify-center gap-5">
      <button
        onClick={onPrev}
        aria-label="이전 기간"
        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
      </button>

      {hasMonthPicker ? (
        <button
          onClick={() => setPickerOpen(prev => !prev)}
          aria-label={`${label} 선택`}
          className="text-xl font-bold text-[var(--text-primary)] min-w-[48px] text-center hover:text-grape-600 transition-colors"
        >
          {label}
        </button>
      ) : (
        <span className="text-xl font-bold text-[var(--text-primary)] min-w-[48px] text-center">
          {label}
        </span>
      )}

      <button
        onClick={onNext}
        aria-label="다음 기간"
        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
      </button>

      {pickerOpen && hasMonthPicker && (
        <MonthPicker
          currentYear={currentYear}
          currentMonth={currentMonth}
          onSelect={onMonthSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
