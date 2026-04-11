import { LineChart, Line } from 'recharts'
import { formatAmount } from '../../utils/format'
import type { ComparisonResponse, PeriodTotal } from '../../types'

type MonthlyComparisonProps = {
  expenseComparison: ComparisonResponse | null
  incomeComparison: ComparisonResponse | null
  /** 저축률 현재월 (제공 시에만 저축률 행 표시) */
  savingsRateCurrent?: number
  savingsRatePrevious?: number
}

/** 스파크라인 — 높이 24px, 너비 64px, 축 없음 */
function Sparkline({ data }: { data: PeriodTotal[] }) {
  // 데이터 포인트 2개 미만이면 의미 있는 추세선을 그릴 수 없음
  if (data.length < 2) return null
  const chartData = data.map(d => ({ value: d.total }))
  return (
    <div data-testid="sparkline">
      <LineChart width={64} height={24} data={chartData}>
        <Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={1.5} dot={false} />
      </LineChart>
    </div>
  )
}

/** 변화량 포맷 (+/-) — 천 단위 구분자, 부호 명시 */
function formatChange(amount: number): string {
  const abs = Math.abs(amount).toLocaleString('ko-KR')
  return amount >= 0 ? `+${abs}` : `-${abs}`
}

type ComparisonRowProps = {
  label: string
  /** 금액 숫자 또는 이미 포맷된 문자열 ("15.1%") */
  current: number | string
  changeAmount: number
  changeLabel: string
  /** true = 증가가 긍정(수입/저축률), false = 감소가 긍정(지출) */
  positiveIsGreen: boolean
  trend: PeriodTotal[]
}

function ComparisonRow({
  label,
  current,
  changeLabel,
  changeAmount,
  positiveIsGreen,
  trend,
}: ComparisonRowProps) {
  const isPositive = changeAmount > 0
  const isGood = positiveIsGreen ? isPositive : !isPositive
  const changeColor =
    changeAmount === 0
      ? 'text-[var(--text-secondary)]'
      : isGood
        ? 'text-leaf-600'
        : 'text-red-600'

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--text-secondary)] w-12 shrink-0">{label}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
            {typeof current === 'number' ? formatAmount(current) : current}
          </span>
          <span className={`text-xs tabular-nums ${changeColor}`}>{changeLabel}</span>
        </div>
        {trend.length >= 2 && (
          <div className={`mt-0.5 ${changeColor} opacity-70`}>
            <Sparkline data={trend} />
          </div>
        )}
      </div>
    </div>
  )
}

// 카테고리 변화 상위 표시 개수
const TOP_CATEGORY_COUNT = 3

export default function MonthlyComparison({
  expenseComparison,
  incomeComparison,
  savingsRateCurrent,
  savingsRatePrevious,
}: MonthlyComparisonProps) {
  // 카테고리 변화 TOP3: 절대 변화율 기준, previous > 0인 항목만 (0 나누기 방지)
  const topCategoryChanges = (expenseComparison?.by_category_comparison ?? [])
    .filter(c => c.change_percentage !== null && c.previous > 0)
    .sort((a, b) => Math.abs(b.change_percentage ?? 0) - Math.abs(a.change_percentage ?? 0))
    .slice(0, TOP_CATEGORY_COUNT)

  const savingsRateChange =
    savingsRateCurrent !== undefined && savingsRatePrevious !== undefined
      ? savingsRateCurrent - savingsRatePrevious
      : null

  return (
    <div
      id="section-comparison"
      className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6"
    >
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">📊 지난달과 비교</h2>

      <div className="space-y-3">
        {incomeComparison && (
          <ComparisonRow
            label="수입"
            current={incomeComparison.current.total}
            changeAmount={incomeComparison.change.amount}
            changeLabel={formatChange(incomeComparison.change.amount)}
            positiveIsGreen={true}
            trend={incomeComparison.trend}
          />
        )}
        {expenseComparison && (
          <ComparisonRow
            label="지출"
            current={expenseComparison.current.total}
            changeAmount={expenseComparison.change.amount}
            changeLabel={formatChange(expenseComparison.change.amount)}
            positiveIsGreen={false}
            trend={expenseComparison.trend}
          />
        )}
        {savingsRateCurrent !== undefined && savingsRateChange !== null && (
          <ComparisonRow
            label="저축률"
            current={`${savingsRateCurrent.toFixed(1)}%`}
            changeAmount={savingsRateChange}
            changeLabel={`${savingsRateChange >= 0 ? '+' : ''}${savingsRateChange.toFixed(1)}%p`}
            positiveIsGreen={true}
            trend={[]}
          />
        )}
      </div>

      {topCategoryChanges.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
          <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">
            카테고리 변화 TOP {topCategoryChanges.length}
          </p>
          <div className="space-y-1.5">
            {topCategoryChanges.map(c => {
              const isIncrease = (c.change_percentage ?? 0) > 0
              return (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <span>{isIncrease ? '🔺' : '🔻'}</span>
                    <span className="text-[var(--text-primary)]">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className={isIncrease ? 'text-red-600' : 'text-leaf-600'}>
                      {isIncrease ? '+' : ''}
                      {c.change_percentage?.toFixed(0)}%
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      ({formatChange(c.change_amount)})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
