/**
 * @file PeriodNavigator.tsx
 * @description ◀ 기간 ▶ 네비게이션 컴포넌트
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PeriodNavigatorProps {
  label: string
  onPrev: () => void
  onNext: () => void
}

export default function PeriodNavigator({ label, onPrev, onNext }: PeriodNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        aria-label="이전 기간"
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-stone-600" />
      </button>
      <span className="text-lg font-semibold text-stone-800 min-w-[160px] text-center">
        {label}
      </span>
      <button
        onClick={onNext}
        aria-label="다음 기간"
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-stone-600" />
      </button>
    </div>
  )
}
