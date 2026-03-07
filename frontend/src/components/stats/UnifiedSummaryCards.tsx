/**
 * @file UnifiedSummaryCards.tsx
 * @description 종합 리포트 핵심 지표 카드 — 총수입/총지출/순수익/저축률
 */

interface UnifiedSummaryCardsProps {
  incomeTotal: number
  expenseTotal: number
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = `₩${abs.toLocaleString('ko-KR')}`
  return amount < 0 ? `-${formatted}` : formatted
}

export default function UnifiedSummaryCards({ incomeTotal, expenseTotal }: UnifiedSummaryCardsProps) {
  const net = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? (net / incomeTotal) * 100 : null

  const netColor = net >= 0 ? 'text-leaf-700' : 'text-red-600'
  const rateColor = savingsRate === null
    ? 'text-warm-400'
    : savingsRate >= 20 ? 'text-leaf-700'
    : savingsRate >= 10 ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-gradient-to-br from-leaf-50 to-leaf-100 border border-leaf-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-leaf-700/70">총 수입</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-warm-900 mt-1">{formatAmount(incomeTotal)}</p>
      </div>
      <div className="bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-grape-700/70">총 지출</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-warm-900 mt-1">{formatAmount(expenseTotal)}</p>
      </div>
      <div className="bg-white border border-warm-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-warm-500">순수익</p>
        <p data-testid="net-income-value" className={`text-xl sm:text-2xl font-bold mt-1 ${netColor}`}>
          {formatAmount(net)}
        </p>
      </div>
      <div className="bg-white border border-warm-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-warm-500">저축률</p>
        <p data-testid="savings-rate-value" className={`text-xl sm:text-2xl font-bold mt-1 ${rateColor}`}>
          {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '-'}
        </p>
      </div>
    </div>
  )
}
