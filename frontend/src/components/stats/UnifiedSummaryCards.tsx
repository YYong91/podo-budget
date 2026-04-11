/**
 * @file UnifiedSummaryCards.tsx
 * @description 이달의 리포트 핵심 지표 카드 — (순자산) + 총수입/총지출/남은 돈/저축률
 * 각 카드 클릭 시 관련 상세 페이지로 이동
 */

import { Link } from 'react-router-dom'
import { FEATURES } from '../../config/features'

type UnifiedSummaryCardsProps = {
  incomeTotal: number
  expenseTotal: number
  /** 저축성 지출 합계 (적금, 투자, 보험 등). 제공 시 저축률 = savingsTotal / incomeTotal */
  savingsTotal?: number
  netWorth?: number | null
  monthStr?: string
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

export default function UnifiedSummaryCards({
  incomeTotal,
  expenseTotal,
  savingsTotal,
  netWorth,
  monthStr,
}: UnifiedSummaryCardsProps) {
  const net = incomeTotal - expenseTotal
  // savingsTotal이 제공된 경우에만 저축성 지출 기반 저축률 계산 (미제공 시 null → "설정 필요" 안내)
  const savingsRate = (savingsTotal !== undefined && incomeTotal > 0)
    ? (savingsTotal / incomeTotal) * 100
    : null

  const SAVINGS_RATE_GOOD_THRESHOLD = 20
  const SAVINGS_RATE_FAIR_THRESHOLD = 10

  const netColor = net >= 0 ? 'text-leaf-600' : 'text-red-600'
  const rateColor =
    savingsRate === null
      ? 'text-[var(--text-muted)]'
      : savingsRate >= SAVINGS_RATE_GOOD_THRESHOLD
        ? 'text-leaf-600'
        : savingsRate >= SAVINGS_RATE_FAIR_THRESHOLD
          ? 'text-amber-600'
          : 'text-red-600'

  const cardBase = "rounded-2xl shadow-sm p-4 sm:p-5 block hover:ring-2 hover:ring-grape-200 transition-shadow"

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 순자산 카드 → 자산 페이지 (FEATURES.assets 활성 시에만 표시) */}
      {FEATURES.assets && netWorth != null && (
        <Link to="/assets" className={`col-span-2 lg:col-span-4 bg-gradient-to-br from-warm-50 to-warm-100 border border-[var(--border-default)] ${cardBase} text-center`}>
          <p className="text-sm text-[var(--text-tertiary)] mb-0.5">순자산</p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{formatLargeAmount(netWorth)}</p>
        </Link>
      )}

      {/* 총 수입 → 홈 목록 */}
      <Link to={monthStr ? `/?month=${monthStr}` : '/'} className={`bg-gradient-to-br from-leaf-50 to-leaf-100 border border-leaf-200/60 ${cardBase}`}>
        <p className="text-sm text-leaf-600/70">총 수입</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          {formatAmount(incomeTotal)}
        </p>
      </Link>

      {/* 총 지출 → 홈 목록 */}
      <Link to={monthStr ? `/?month=${monthStr}` : '/'} className={`bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200/60 ${cardBase}`}>
        <p className="text-sm text-grape-600/70">총 지출</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          {formatAmount(expenseTotal)}
        </p>
      </Link>

      {/* 남은 돈 (네비게이션 없음) */}
      <div className={`bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5`}>
        <p className="text-sm text-[var(--text-tertiary)]">남은 돈</p>
        <p data-testid="net-income-value" className={`text-xl sm:text-2xl font-bold mt-1 ${netColor}`}>
          {formatAmount(net)}
        </p>
      </div>

      {/* 저축률 — savingsTotal 미제공 시 카테고리 설정 안내 링크 표시 */}
      <div className={`bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5`}>
        <p className="text-sm text-[var(--text-tertiary)]">저축률</p>
        {savingsRate !== null ? (
          <p data-testid="savings-rate-value" className={`text-xl sm:text-2xl font-bold mt-1 ${rateColor}`}>
            {savingsRate.toFixed(1)}%
          </p>
        ) : (
          <Link
            to="/settings/categories"
            className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block"
          >
            설정 필요
          </Link>
        )}
      </div>
    </div>
  )
}
