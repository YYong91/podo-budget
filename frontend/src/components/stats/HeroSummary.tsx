import { useEffect, useState, type ReactNode } from 'react'
import { formatAmount } from '../../utils/format'

interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string
  /** true이면 sublabel 영역을 invisible로 공간 예약 (레이아웃 시프트 방지) */
  sublabelLoading?: boolean
  /** 예산 사용 비율 (0~1+). 주어지면 프로그레스 바 표시 */
  budgetRatio?: number
  /** 예산 잔여액 (음수이면 초과). budgetRatio와 함께 사용 */
  remainingBudget?: number
  children?: ReactNode
  className?: string
}

/** 예산 비율에 따른 프로그레스 바 색상 결정 */
function getBudgetFillColor(percentage: number): string {
  if (percentage > 100) return 'bg-red-400'
  if (percentage >= 80) return 'bg-amber-400'
  return 'bg-grape-400'
}

export default function HeroSummary({ label, amount, sublabel, sublabelLoading, budgetRatio, remainingBudget, children, className = '' }: HeroSummaryProps) {
  const percentage = budgetRatio != null ? Math.round(budgetRatio * 100) : null

  const [animatedWidth, setAnimatedWidth] = useState(0)
  useEffect(() => {
    if (percentage != null) {
      // requestAnimationFrame으로 초기 0% 너비가 먼저 렌더링된 후 목표 너비로 전환
      requestAnimationFrame(() => setAnimatedWidth(Math.min(percentage, 100)))
    }
  }, [percentage])

  return (
    <div className={`card-surface p-6 bg-gradient-to-b from-grape-50/60 to-transparent dark:from-grape-900/30 dark:to-transparent ${className}`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(amount)}</p>
      {/* sublabelLoading 시 공간 예약으로 레이아웃 시프트 방지 */}
      {(sublabel || sublabelLoading) && (
        <p className={`text-xs mt-2 ${sublabel ? 'text-[var(--text-muted)]' : 'invisible'}`}>
          {sublabel ?? '\u00A0'}
        </p>
      )}
      {percentage != null && (
        <div
          role="progressbar"
          aria-valuenow={percentage}
          className={`mt-3 ${sublabelLoading ? 'invisible' : ''}`}
        >
          <div className="h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${getBudgetFillColor(percentage)} transition-all duration-700 ease-out`}
              style={{ width: `${animatedWidth}%` }}
            />
          </div>
          {remainingBudget != null && (
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                예산 {percentage}% 사용
              </span>
              {remainingBudget >= 0 ? (
                <span className="text-[10px] text-grape-500 dark:text-grape-300 font-medium tabular-nums">
                  {formatAmount(remainingBudget)} 남음
                </span>
              ) : (
                <span className="text-[10px] text-red-500 font-medium tabular-nums">
                  {formatAmount(Math.abs(remainingBudget))} 초과
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
