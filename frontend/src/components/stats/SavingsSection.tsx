import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount } from '../../utils/format'
import type { CategoryAmount } from '../../types'
import SectionHeader from './SectionHeader'

type SavingsSectionProps = {
  savingsTotal: number | undefined      // undefined = is_savings 미설정
  incomeTotal: number
  savingsCategories: CategoryAmount[]   // is_savings=true 카테고리만 필터링된 목록
  recurringTotal?: number               // 고정비(정기거래 지출 합계), 미전달 시 0
  expenseTotal?: number                 // 총지출, 미전달 시 0
}

/** 수입 배분 stacked bar (순수 CSS flex 비율) */
function IncomeFlowBar({
  savingsPct,
  fixedPct,
  variablePct,
  remainingPct,
  incomeTotal,
}: {
  savingsPct: number
  fixedPct: number
  variablePct: number
  remainingPct: number
  incomeTotal: number
}) {
  const isOverspent = remainingPct < 0

  if (isOverspent) {
    const total = savingsPct + fixedPct + variablePct || 1
    return (
      <div data-testid="income-flow-bar" className="space-y-1">
        <div className="flex h-1.5 rounded-full overflow-hidden w-full">
          <div className="bg-leaf-500 transition-all" style={{ width: `${(savingsPct / total) * 100}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${(fixedPct / total) * 100}%` }} />
          <div className="bg-grape-400 transition-all" style={{ width: `${(variablePct / total) * 100}%` }} />
        </div>
        <p className="text-xs text-red-600 text-right">
          초과 {formatAmount(Math.abs(Math.round((remainingPct / 100) * incomeTotal)))}
        </p>
      </div>
    )
  }

  return (
    <div data-testid="income-flow-bar" className="flex h-1.5 rounded-full overflow-hidden w-full">
      <div className="bg-leaf-500 transition-all" style={{ width: `${savingsPct}%` }} />
      <div className="bg-amber-400 transition-all" style={{ width: `${fixedPct}%` }} />
      <div className="bg-grape-400 transition-all" style={{ width: `${variablePct}%` }} />
      <div className="bg-[var(--border-default)] transition-all" style={{ width: `${remainingPct}%` }} />
    </div>
  )
}


export default function SavingsSection({
  savingsTotal,
  incomeTotal,
  savingsCategories,
  recurringTotal = 0,
  expenseTotal = 0,
}: SavingsSectionProps) {
  // 카테고리와 총액이 모두 있어야 유효한 데이터로 판단
  const hasData = savingsCategories.length > 0 && savingsTotal !== undefined
  const [expanded, setExpanded] = useState(false)

  const showBar = incomeTotal > 0 && savingsTotal !== undefined
  const savingsPct = showBar ? (savingsTotal / incomeTotal) * 100 : 0
  const fixedPct = showBar ? (recurringTotal / incomeTotal) * 100 : 0
  const rawVariablePct = showBar ? ((expenseTotal - savingsTotal - recurringTotal) / incomeTotal) * 100 : 0
  const variablePct = Math.max(0, rawVariablePct)
  const remainingPct = showBar ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0
  const savingsRate = incomeTotal > 0 && savingsTotal !== undefined
    ? (savingsTotal / incomeTotal) * 100
    : undefined

  return (
    <div id="section-savings" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <SectionHeader
        icon="⚖️"
        title="지출 구성"
        manageTo="/categories"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
        collapsible={hasData}
      />

      {hasData ? (
        <div className="mt-3">
          {showBar && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              <span className="text-sm font-medium text-leaf-600">저축 {savingsPct.toFixed(1)}%</span>
              <span className="text-sm font-medium text-amber-600">고정 {fixedPct.toFixed(1)}%</span>
              <span className="text-sm font-medium text-grape-600">변동 {variablePct.toFixed(1)}%</span>
            </div>
          )}

          {showBar && (
            <IncomeFlowBar
              savingsPct={savingsPct}
              fixedPct={fixedPct}
              variablePct={variablePct}
              remainingPct={remainingPct}
              incomeTotal={incomeTotal}
            />
          )}

          {expanded && (
            <div className="mt-3 space-y-3 pt-3 border-t border-[var(--border-default)]">
              {savingsCategories.map(c => (
                <div key={c.category} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{c.category}</span>
                  <span className="text-sm tabular-nums text-[var(--text-primary)]">{formatAmount(c.amount)}</span>
                </div>
              ))}
              {showBar && (
                <>
                  <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <span>고정비</span>
                    <span className="tabular-nums">{formatAmount(recurringTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <span>변동비</span>
                    <span className="tabular-nums">{formatAmount(Math.max(0, expenseTotal - savingsTotal! - recurringTotal))}</span>
                  </div>
                  {remainingPct >= 0 && (
                    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                      <span>여유</span>
                      <span className="tabular-nums text-leaf-600">{formatAmount(incomeTotal - expenseTotal)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 mt-3">
          <p className="text-sm text-[var(--text-tertiary)]">저축 카테고리를 설정하면 저축 현황을 볼 수 있어요</p>
          <Link to="/categories" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">
            카테고리 설정 →
          </Link>
        </div>
      )}
    </div>
  )
}
