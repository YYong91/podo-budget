/**
 * @file StatsSummaryCards.tsx
 * @description 통계 요약 카드 4개 (총 지출, 전기 대비, 건수, 일 평균)
 */

import ChangeIndicator from './ChangeIndicator'
import type { TrendPoint } from '../../types'

interface StatsSummaryCardsProps {
  total: number
  count: number
  trend: TrendPoint[]
  changePercentage: number | null
  totalLabel?: string
  accentColor?: 'grape' | 'emerald'
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function StatsSummaryCards({ total, count, trend, changePercentage, totalLabel = '총 지출', accentColor = 'grape' }: StatsSummaryCardsProps) {
  const avgDaily = trend.length > 0 ? Math.round(total / trend.length) : 0
  const gradientClass = accentColor === 'emerald'
    ? 'from-emerald-50 to-green-50 border-emerald-200/60'
    : 'from-grape-50 to-grape-100 border-grape-200/60'
  const labelClass = accentColor === 'emerald' ? 'text-emerald-700/70' : 'text-grape-700/70'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className={`bg-gradient-to-br ${gradientClass} rounded-2xl border shadow-sm p-4 sm:p-5`}>
        <p className={`text-sm ${labelClass}`}>{totalLabel}</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 mt-1">{formatAmount(total)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">전기 대비</p>
        <div className="mt-2">
          <ChangeIndicator percentage={changePercentage} />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">건 수</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">{count}건</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">일 평균</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">{formatAmount(avgDaily)}</p>
      </div>
    </div>
  )
}
