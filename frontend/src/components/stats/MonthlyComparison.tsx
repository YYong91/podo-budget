import { useState } from 'react'
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from 'recharts'
import type { ComparisonResponse, PeriodTotal } from '../../types'
import { formatCompact, formatChange } from '../../utils/format'
import SectionHeader from './SectionHeader'

type MonthlyComparisonProps = {
  expenseComparison: ComparisonResponse | null
  incomeComparison: ComparisonResponse | null
  /** 저축률 현재월 (제공 시에만 저축률 행 표시) */
  savingsRateCurrent?: number
  savingsRatePrevious?: number
}

/** 3개월 트렌드 BarChart — 수입/지출 비교 막대 */
function TrendBarChart({
  expenseTrend,
  incomeTrend,
}: {
  expenseTrend: PeriodTotal[]
  incomeTrend: PeriodTotal[]
}) {
  if (expenseTrend.length < 2) {
    return (
      <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
        비교할 이전 데이터가 없습니다
      </p>
    )
  }

  const incomeMap = new Map(incomeTrend.map(d => [d.label, d.total]))
  const chartData = expenseTrend.map(d => ({
    name: d.label,
    수입: incomeMap.get(d.label) ?? 0,
    지출: d.total,
  }))

  return (
    <div data-testid="trend-bar-chart">
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 18, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Bar dataKey="수입" fill="#4ade80" radius={[2, 2, 0, 0]}>
            <LabelList
              dataKey="수입"
              position="top"
              style={{ fontSize: 9, fill: 'var(--text-muted)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => {
                if (typeof v !== 'number' || v <= 0) return ''
                const man = Math.round(v / 10000)
                return man > 0 ? `${man}만` : ''
              }}
            />
          </Bar>
          <Bar dataKey="지출" fill="#a855f7" radius={[2, 2, 0, 0]}>
            <LabelList
              dataKey="지출"
              position="top"
              style={{ fontSize: 9, fill: 'var(--text-muted)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => {
                if (typeof v !== 'number' || v <= 0) return ''
                const man = Math.round(v / 10000)
                return man > 0 ? `${man}만` : ''
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-leaf-400" /> 수입
        </span>
        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-grape-500" /> 지출
        </span>
      </div>
    </div>
  )
}


type ComparisonRowProps = {
  label: string
  current: number
  previous: number
  changeAmount: number
  /** true = 증가가 긍정(수입/저축률), false = 감소가 긍정(지출) */
  positiveIsGreen: boolean
}

function ComparisonRow({ label, current, previous, changeAmount, positiveIsGreen }: ComparisonRowProps) {
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
      <SectionHeader
        icon="📈"
        title="지난달 비교"
        expanded={expanded}
        onToggle={() => setExpanded(prev => !prev)}
      />

      {/* 2열 비교 행 */}
      <div className="mt-3 space-y-3">
        {incomeComparison && (
          <ComparisonRow
            label="수입"
            current={incomeComparison.current.total}
            previous={incomeComparison.previous.total}
            changeAmount={incomeComparison.change.amount}
            positiveIsGreen={true}
          />
        )}
        {expenseComparison && (
          <ComparisonRow
            label="지출"
            current={expenseComparison.current.total}
            previous={expenseComparison.previous.total}
            changeAmount={expenseComparison.change.amount}
            positiveIsGreen={false}
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

      {/* 펼친 상태: TrendBarChart + 카테고리 변화 TOP3 */}
      {expanded && (
        <>
          {/* 3개월 트렌드 BarChart */}
          <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
            <TrendBarChart
              expenseTrend={expenseComparison?.trend ?? []}
              incomeTrend={incomeComparison?.trend ?? []}
            />
          </div>

          {/* 카테고리 변화 TOP3 with 미니 horizontal bar */}
          {topCategoryChanges.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
              <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">
                카테고리 변화 TOP {topCategoryChanges.length}
              </p>
              <div className="space-y-2">
                {topCategoryChanges.map(c => {
                  const isIncrease = (c.change_percentage ?? 0) > 0
                  const maxPct = Math.max(...topCategoryChanges.map(x => Math.abs(x.change_percentage ?? 0)))
                  const barWidth = maxPct > 0 ? (Math.abs(c.change_percentage ?? 0) / maxPct) * 100 : 0
                  return (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <span>{isIncrease ? '🔺' : '🔻'}</span>
                          <span className="text-[var(--text-primary)]">{c.category}</span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className={isIncrease ? 'text-red-600' : 'text-leaf-600'}>
                            {isIncrease ? '+' : ''}{c.change_percentage?.toFixed(0)}%
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            ({formatChange(c.change_amount)})
                          </span>
                        </div>
                      </div>
                      {/* 미니 horizontal bar */}
                      <div className="h-1 rounded-full bg-[var(--border-default)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isIncrease ? 'bg-red-400' : 'bg-leaf-400'} transition-all`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
