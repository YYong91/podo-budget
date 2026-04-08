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
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={onPrev}
        aria-label="이전 기간"
        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
      </button>
      <span className="text-xl font-bold text-[var(--text-primary)] min-w-[48px] text-center">
        {label}
      </span>
      <button
        onClick={onNext}
        aria-label="다음 기간"
        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" strokeWidth={1.5} />
      </button>
    </div>
  )
}
