/**
 * @file MonthPicker.tsx
 * @description 연도/월 선택 팝업 — PeriodNavigator에서 월 텍스트 클릭 시 표시
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthPickerProps {
  currentYear: number
  currentMonth: number  // 0-indexed
  onSelect: (year: number, month: number) => void  // month: 0-indexed
  onClose: () => void
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export default function MonthPicker({ currentYear, currentMonth, onSelect, onClose }: MonthPickerProps) {
  const [pickerYear, setPickerYear] = useState(currentYear)

  const handleSelect = (month: number) => {
    onSelect(pickerYear, month)
    onClose()
  }

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-lg p-4 w-64">
      {/* 연도 네비게이터 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setPickerYear(y => y - 1)}
          aria-label="이전 연도"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
        </button>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{pickerYear}</span>
        <button
          onClick={() => setPickerYear(y => y + 1)}
          aria-label="다음 연도"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
        </button>
      </div>

      {/* 월 그리드 (4x3) */}
      <div className="grid grid-cols-4 gap-1">
        {MONTH_LABELS.map((label, idx) => {
          const isSelected = pickerYear === currentYear && idx === currentMonth
          return (
            <button
              key={label}
              onClick={() => handleSelect(idx)}
              className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-grape-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
