/**
 * @file UnifiedSummaryCards.tsx
 * @description 종합 리포트 핵심 지표 카드 — (순자산) + 총수입/총지출/순수익/저축률
 */

interface UnifiedSummaryCardsProps {
  incomeTotal: number
  expenseTotal: number
  netWorth?: number | null
  prevNetWorth?: number | null
  prevIncome?: number | null
  prevExpense?: number | null
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = `₩${abs.toLocaleString('ko-KR')}`
  return amount < 0 ? `-${formatted}` : formatted
}

function formatLargeAmount(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`
  if (abs >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`
  return formatAmount(amount)
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const color = pct >= 0 ? 'text-leaf-600' : 'text-red-600'
  return (
    <p className={`text-[10px] mt-0.5 ${color}`}>
      전월 {pct >= 0 ? '+' : ''}
      {pct.toFixed(0)}%
    </p>
  )
}

export default function UnifiedSummaryCards({
  incomeTotal,
  expenseTotal,
  netWorth,
  prevNetWorth,
  prevIncome,
  prevExpense,
}: UnifiedSummaryCardsProps) {
  const net = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? (net / incomeTotal) * 100 : null

  const netColor = net >= 0 ? 'text-leaf-600' : 'text-red-600'
  const rateColor =
    savingsRate === null
      ? 'text-[var(--text-muted)]'
      : savingsRate >= 20
        ? 'text-leaf-600'
        : savingsRate >= 10
          ? 'text-amber-600'
          : 'text-red-600'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 순자산 카드 (자산 데이터가 있을 때만) */}
      {netWorth != null && (
        <div className="col-span-2 lg:col-span-4 bg-gradient-to-br from-warm-50 to-warm-100 border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5 text-center">
          <p className="text-sm text-[var(--text-tertiary)] mb-0.5">순자산</p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{formatLargeAmount(netWorth)}</p>
          {prevNetWorth != null && prevNetWorth !== 0 && (
            <ChangeIndicator current={netWorth} previous={prevNetWorth} />
          )}
        </div>
      )}

      <div className="bg-gradient-to-br from-leaf-50 to-leaf-100 border border-leaf-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-leaf-700/70">총 수입</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          {formatAmount(incomeTotal)}
        </p>
        {prevIncome != null && prevIncome > 0 && (
          <ChangeIndicator current={incomeTotal} previous={prevIncome} />
        )}
      </div>
      <div className="bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-grape-700/70">총 지출</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          {formatAmount(expenseTotal)}
        </p>
        {prevExpense != null && prevExpense > 0 && (
          <ChangeIndicator current={expenseTotal} previous={prevExpense} />
        )}
      </div>
      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-[var(--text-tertiary)]">순수익</p>
        <p data-testid="net-income-value" className={`text-xl sm:text-2xl font-bold mt-1 ${netColor}`}>
          {formatAmount(net)}
        </p>
      </div>
      <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-[var(--text-tertiary)]">저축률</p>
        <p data-testid="savings-rate-value" className={`text-xl sm:text-2xl font-bold mt-1 ${rateColor}`}>
          {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '-'}
        </p>
      </div>
    </div>
  )
}
