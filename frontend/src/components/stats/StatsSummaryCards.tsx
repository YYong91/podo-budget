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
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function StatsSummaryCards({ total, count, trend, changePercentage }: StatsSummaryCardsProps) {
  const avgDaily = trend.length > 0 ? Math.round(total / trend.length) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-amber-700/70">총 지출</p>
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
