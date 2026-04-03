/**
 * @file NetWorthHero.tsx
 * @description 순자산 히어로 — 순자산 큰 숫자 + 자산/부채 소계
 */

import { formatAmount } from '../../utils/format'

interface NetWorthHeroProps {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

export default function NetWorthHero({ netWorth, totalAssets, totalLiabilities }: NetWorthHeroProps) {
  const isPositive = netWorth >= 0

  return (
    <div className={`rounded-2xl border shadow-sm p-6 ${
      isPositive
        ? 'bg-gradient-to-br from-grape-50 to-grape-100 border-grape-200/60 dark:from-grape-900/30 dark:to-grape-800/20'
        : 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200/60 dark:from-rose-900/30 dark:to-red-900/20'
    }`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">순자산</p>
      <p className={`text-display ${isPositive ? 'text-grape-600' : 'text-rose-600'}`}>
        {formatAmount(netWorth)}
      </p>
      <div className="flex gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
        <span>자산 {formatAmount(totalAssets)}</span>
        <span>부채 {formatAmount(totalLiabilities)}</span>
      </div>
    </div>
  )
}
