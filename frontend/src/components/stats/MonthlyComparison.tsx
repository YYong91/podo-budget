import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { LineChart, Line } from 'recharts'
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

function formatCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(1)}억원`
  if (abs >= 10_000) return `${Math.round(abs / 10_000).toLocaleString()}만원`
  return `${abs.toLocaleString('ko-KR')}원`
}

function formatChange(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatCompact(Math.abs(amount))}`
}

type ComparisonRowProps = {
  label: string
  current: number
  previous: number
  changeAmount: number
  /** true = 증가가 긍정(수입/저축률), false = 감소가 긍정(지출) */
  positiveIsGreen: boolean
  trend: PeriodTotal[]
  showTrend: boolean
}

function ComparisonRow({ label, current, previous, changeAmount, positiveIsGreen, trend, showTrend }: ComparisonRowProps) {
  const isPositive = changeAmount > 0
  const isGood = positiveIsGreen ? isPositive : !isPositive
  const changeColor =
    changeAmount === 0
      ? 'text-[var(--text-secondary)]'
      : isGood
        ? 'text-leaf-600'
        : 'text-red-600'

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--text-secondary)] w-10 shrink-0">{label}</span>
      {/* 2열: 지난달 → 이번달 */}
      <div className="flex-1 flex items-center gap-1.5">
        <span className="text-sm tabular-nums text-[var(--text-muted)]">{formatCompact(previous)}</span>
        <span className="text-xs text-[var(--text-muted)]">→</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{formatCompact(current)}</span>
        <span className={`text-xs tabular-nums ml-1 ${changeColor}`}>{formatChange(changeAmount)}</span>
      </div>
      {/* 스파크라인: 펼쳐진 상태에서만 */}
      {showTrend && trend.length >= 2 && (
        <div className={`${changeColor} opacity-70 shrink-0`}>
          <Sparkline data={trend} />
        </div>
      )}
    </div>
  )
}

type SavingsRateRowProps = {
  current: number
  previous: number
  change: number
}

function SavingsRateRow({ current, previous, change }: SavingsRateRowProps) {
  const isGood = change >= 0
  const changeColor = change === 0 ? 'text-[var(--text-secondary)]' : isGood ? 'text-leaf-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--text-secondary)] w-10 shrink-0">저축률</span>
      <div className="flex-1 flex items-center gap-1.5">
        <span className="text-sm tabular-nums text-[var(--text-muted)]">{previous.toFixed(1)}%</span>
        <span className="text-xs text-[var(--text-muted)]">→</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{current.toFixed(1)}%</span>
        <span className={`text-xs tabular-nums ml-1 ${changeColor}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%p
        </span>
      </div>
    </div>
  )
}

const TOP_CATEGORY_COUNT = 3

export default function MonthlyComparison({
  expenseComparison,
  incomeComparison,
  savingsRateCurrent,
  savingsRatePrevious,
}: MonthlyComparisonProps) {
  const [expanded, setExpanded] = useState(false)

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
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">📊 지난달과 비교</h2>
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-0.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label={expanded ? '접기' : '펼치기'}
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> 접기</>
            : <><ChevronDown className="w-3.5 h-3.5" /> 펼치기</>
          }
        </button>
      </div>

      {/* 2열 비교 행 */}
      <div className="space-y-3">
        {incomeComparison && (
          <ComparisonRow
            label="수입"
            current={incomeComparison.current.total}
            previous={incomeComparison.previous.total}
            changeAmount={incomeComparison.change.amount}
            positiveIsGreen={true}
            trend={incomeComparison.trend}
            showTrend={expanded}
          />
        )}
        {expenseComparison && (
          <ComparisonRow
            label="지출"
            current={expenseComparison.current.total}
            previous={expenseComparison.previous.total}
            changeAmount={expenseComparison.change.amount}
            positiveIsGreen={false}
            trend={expenseComparison.trend}
            showTrend={expanded}
          />
        )}
        {savingsRateCurrent !== undefined && savingsRateChange !== null && savingsRatePrevious !== undefined && (
          <SavingsRateRow
            current={savingsRateCurrent}
            previous={savingsRatePrevious}
            change={savingsRateChange}
          />
        )}
      </div>

      {/* 펼친 상태: 카테고리 변화 TOP3 + 스파크라인 */}
      {expanded && topCategoryChanges.length > 0 && (
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
