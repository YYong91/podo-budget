import type { ReactNode } from 'react'
import { formatAmount } from '../../utils/format'

interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string
  /** true이면 sublabel 영역을 invisible로 공간 예약 (레이아웃 시프트 방지) */
  sublabelLoading?: boolean
  children?: ReactNode
  className?: string
}

export default function HeroSummary({ label, amount, sublabel, sublabelLoading, children, className = '' }: HeroSummaryProps) {
  return (
    <div className={`card-surface p-6 ${className}`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(amount)}</p>
      {/* sublabelLoading 시 공간 예약으로 레이아웃 시프트 방지 */}
      {(sublabel || sublabelLoading) && (
        <p className={`text-xs mt-2 ${sublabel ? 'text-[var(--text-muted)]' : 'invisible'}`}>
          {sublabel ?? '\u00A0'}
        </p>
      )}
      {children}
    </div>
  )
}
