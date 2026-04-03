import type { ReactNode } from 'react'
import { formatAmount } from '../../utils/format'

interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string
  children?: ReactNode
  className?: string
}

export default function HeroSummary({ label, amount, sublabel, children, className = '' }: HeroSummaryProps) {
  return (
    <div className={`card-surface p-6 ${className}`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(amount)}</p>
      {sublabel && (
        <p className="text-xs text-[var(--text-muted)] mt-2">{sublabel}</p>
      )}
      {children}
    </div>
  )
}
