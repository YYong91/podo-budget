import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount, formatCompactAmount } from '../../utils/format'

// --- 새로운 3구간 프로그레스바 props ---
type NewHeroSummaryProps = {
  label: string
  totalExpense: number
  totalBudget: number | null | undefined // null=미설정, undefined=로딩
  pendingRecurringExpense: number
  totalIncome?: number
  onProgressClick?: () => void
  children?: ReactNode
  className?: string
}

// --- 레거시 props (InsightsPage 호환) ---
type LegacyHeroSummaryProps = {
  label: string
  amount: number
  sublabel?: string
  sublabelLoading?: boolean
  budgetRatio?: number
  remainingBudget?: number
  children?: ReactNode
  className?: string
}

type HeroSummaryProps = NewHeroSummaryProps | LegacyHeroSummaryProps

/** 새 props인지 판별 */
function isNewProps(props: HeroSummaryProps): props is NewHeroSummaryProps {
  return 'totalExpense' in props
}

/** 금액 축약 포맷 (₩ 접두사 포함) */
function formatWon(amount: number): string {
  if (amount === 0) return '₩0'
  return `₩${formatCompactAmount(amount)}`
}

// ─── 상태 분류 ───

type BudgetState =
  | { type: 'normal'; actualPct: number; projectedPct: number; remaining: number }
  | { type: 'noRecurring'; actualPct: number; remaining: number }
  | { type: 'projectedExceed'; actualPct: number; overflowAmount: number }
  | { type: 'exceeded'; overAmount: number; pendingLeft: number }
  | { type: 'noBudget'; hasRecurring: boolean }
  | { type: 'loading' }

function classifyBudgetState(
  totalExpense: number,
  totalBudget: number | null | undefined,
  pendingRecurringExpense: number,
): BudgetState {
  // 로딩
  if (totalBudget === undefined) return { type: 'loading' }

  // 예산 미설정
  if (totalBudget === null || totalBudget <= 0) {
    return { type: 'noBudget', hasRecurring: pendingRecurringExpense > 0 }
  }

  // D. 실제 초과
  if (totalExpense > totalBudget) {
    return {
      type: 'exceeded',
      overAmount: totalExpense - totalBudget,
      pendingLeft: pendingRecurringExpense,
    }
  }

  const actualPct = (totalExpense / totalBudget) * 100
  const projectedTotal = totalExpense + pendingRecurringExpense

  // B. 정기지출 없음
  if (pendingRecurringExpense === 0) {
    return {
      type: 'noRecurring',
      actualPct,
      remaining: totalBudget - totalExpense,
    }
  }

  // C. 예상 포함 초과
  if (projectedTotal > totalBudget) {
    return {
      type: 'projectedExceed',
      actualPct,
      overflowAmount: projectedTotal - totalBudget,
    }
  }

  // A. 정상
  return {
    type: 'normal',
    actualPct,
    projectedPct: (pendingRecurringExpense / totalBudget) * 100,
    remaining: totalBudget - projectedTotal,
  }
}

// ─── aria-label 생성 ───

function buildAriaLabel(
  state: BudgetState,
  totalExpense: number,
  totalBudget: number | null | undefined,
  pendingRecurringExpense: number,
): string {
  if (state.type === 'loading') return '예산 정보 로딩 중'
  if (state.type === 'noBudget') return '예산 미설정'
  const budgetStr = formatAmount(totalBudget as number)
  switch (state.type) {
    case 'normal':
      return `예산 ${budgetStr} 중 ${formatAmount(totalExpense)} 사용, ${formatAmount(pendingRecurringExpense)} 예정, ${formatAmount(state.remaining)} 남은`
    case 'noRecurring':
      return `예산 ${budgetStr} 중 ${formatAmount(totalExpense)} 사용, ${formatAmount(state.remaining)} 남음`
    case 'projectedExceed':
      return `예산 ${budgetStr} 중 ${formatAmount(totalExpense)} 사용, 정기지출 포함 ${formatAmount(state.overflowAmount)} 초과 예상`
    case 'exceeded':
      return `예산 ${budgetStr} 초과, ${formatAmount(state.overAmount)} 초과`
    default:
      return ''
  }
}

// ─── 프로그레스바 3구간 렌더링 ───

function ProgressBar({
  state,
  totalExpense,
  totalBudget,
  pendingRecurringExpense,
}: {
  state: Exclude<BudgetState, { type: 'noBudget' }>
  totalExpense: number
  totalBudget: number | null | undefined
  pendingRecurringExpense: number
}) {
  const budget = totalBudget as number
  const isLoading = state.type === 'loading'

  // 애니메이션용 상태
  const [animActual, setAnimActual] = useState(0)
  const [animProjected, setAnimProjected] = useState(0)

  useEffect(() => {
    if (isLoading) return

    let actualWidth = 0
    let projectedWidth = 0

    switch (state.type) {
      case 'normal': {
        actualWidth = state.actualPct
        projectedWidth = state.projectedPct
        break
      }
      case 'noRecurring': {
        actualWidth = state.actualPct
        break
      }
      case 'projectedExceed': {
        // 실제 지출 비율 (예산 대비)
        actualWidth = state.actualPct
        // 예정 지출 — 150% 클램프 기준으로 계산
        const projPct = (pendingRecurringExpense / budget) * 100
        projectedWidth = Math.min(projPct, 150 - actualWidth)
        break
      }
      case 'exceeded': {
        // 실제 지출이 초과 — 150% 클램프
        actualWidth = Math.min((totalExpense / budget) * 100, 150)
        projectedWidth = 0
        break
      }
    }

    requestAnimationFrame(() => {
      setAnimActual(actualWidth)
      setAnimProjected(projectedWidth)
    })
  }, [state, isLoading, budget, totalExpense, pendingRecurringExpense])

  // 초과 상태에서 예산 마커 라인 표시 여부
  const showBudgetMarker = state.type === 'projectedExceed' || state.type === 'exceeded'
  // 전체 바 최대 폭 (100% 또는 150%)
  const totalBarMax = showBudgetMarker ? 150 : 100

  // 실제 바 색상
  const getActualColor = () => {
    if (state.type === 'exceeded') return 'bg-red-400'
    const pct = (totalExpense / budget) * 100
    if (pct >= 80) return 'bg-amber-400'
    return 'bg-grape-400'
  }

  const ariaLabel = buildAriaLabel(state, totalExpense, totalBudget, pendingRecurringExpense)

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.min(Math.round((totalExpense / budget) * 100), 100)}
      aria-label={ariaLabel}
      className={`mt-3 ${isLoading ? 'invisible' : ''}`}
    >
      {/* 바 트랙 */}
      <div className="relative h-2 bg-[var(--surface-hover)] rounded-full overflow-visible">
        {/* 실제 지출 구간 */}
        <div
          className={`absolute top-0 left-0 h-full rounded-l-full ${animProjected === 0 ? 'rounded-r-full' : ''} ${getActualColor()} transition-all duration-700 ease-out`}
          style={{ width: `${(animActual / totalBarMax) * 100}%` }}
        />
        {/* 예정 지출 구간 */}
        {animProjected > 0 && (
          <div
            className={`absolute top-0 h-full rounded-r-full ${
              state.type === 'projectedExceed' ? 'bg-warm-300 dark:bg-warm-400' : 'bg-grape-200 dark:bg-grape-300'
            } transition-all duration-700 ease-out`}
            style={{
              left: `${(animActual / totalBarMax) * 100}%`,
              width: `${(animProjected / totalBarMax) * 100}%`,
            }}
          />
        )}
        {/* 예산 마커 라인 (초과 상태에서만) */}
        {showBudgetMarker && (
          <div
            className="absolute top-[-2px] h-[calc(100%+4px)] w-px bg-[var(--text-secondary)]"
            style={{ left: `${(100 / totalBarMax) * 100}%` }}
          />
        )}
      </div>

      {/* 하단 텍스트 */}
      <div className="flex flex-wrap items-center gap-x-1.5 mt-1.5 text-[10px] tabular-nums">
        {state.type === 'normal' && (
          <>
            <span className="text-[var(--text-muted)]">
              지출 {formatWon(totalExpense)} ({Math.round(state.actualPct)}%)
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-grape-400 dark:text-grape-300">
              예정 {formatWon(pendingRecurringExpense)}
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-grape-500 dark:text-grape-300 font-medium">
              남은 {formatWon(state.remaining)}
            </span>
          </>
        )}
        {state.type === 'noRecurring' && (
          <>
            <span className="text-[var(--text-muted)]">
              지출 {formatWon(totalExpense)} ({Math.round(state.actualPct)}%)
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-grape-500 dark:text-grape-300 font-medium">
              남은 예산 {formatWon(state.remaining)}
            </span>
          </>
        )}
        {state.type === 'projectedExceed' && (
          <>
            <span className="text-[var(--text-muted)]">
              지출 {formatWon(totalExpense)} ({Math.round(state.actualPct)}%)
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--text-muted)]">
              예정 {formatWon(pendingRecurringExpense)}
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-warm-600 dark:text-warm-400 font-medium">
              {formatWon(state.overflowAmount)} 초과 예상 ⚠️
            </span>
          </>
        )}
        {state.type === 'exceeded' && (
          <>
            <span className="text-red-500 font-medium">
              {formatWon(state.overAmount)} 초과
            </span>
            {state.pendingLeft > 0 && (
              <>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)]">
                  예정 {formatWon(state.pendingLeft)} 남음
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 예산 미설정 CTA ───

function NoBudgetCta({ hasRecurring }: { hasRecurring: boolean }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--surface-hover)]">
      <p className="text-xs text-[var(--text-muted)]">
        {hasRecurring
          ? '예산을 설정하면 정기지출 예정까지 한눈에 확인할 수 있어요'
          : '예산을 설정하면 지출 속도를 한눈에 확인할 수 있어요'}
      </p>
      <Link
        to="/settings/budget"
        className="inline-block mt-1.5 text-xs text-grape-500 dark:text-grape-300 font-medium hover:underline"
      >
        예산 설정하기 →
      </Link>
    </div>
  )
}

// ─── 레거시 렌더러 (InsightsPage 호환) ───

/** 예산 비율에 따른 프로그레스 바 색상 결정 */
function getBudgetFillColor(percentage: number): string {
  if (percentage > 100) return 'bg-red-400'
  if (percentage >= 80) return 'bg-amber-400'
  return 'bg-grape-400'
}

function LegacyHeroSummary({ label, amount, sublabel, sublabelLoading, budgetRatio, remainingBudget, children, className = '' }: LegacyHeroSummaryProps) {
  const percentage = budgetRatio != null ? Math.round(budgetRatio * 100) : null

  const [animatedWidth, setAnimatedWidth] = useState(0)
  useEffect(() => {
    if (percentage != null) {
      requestAnimationFrame(() => setAnimatedWidth(Math.min(percentage, 100)))
    }
  }, [percentage])

  return (
    <div className={`card-surface p-6 bg-gradient-to-b from-grape-50/60 to-transparent dark:from-grape-900/30 dark:to-transparent ${className}`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(amount)}</p>
      {(sublabel || sublabelLoading) && (
        <p className={`text-xs mt-2 ${sublabel ? 'text-[var(--text-muted)]' : 'invisible'}`}>
          {sublabel ?? '\u00A0'}
        </p>
      )}
      {percentage != null && (
        <div
          role="progressbar"
          aria-valuenow={percentage}
          className={`mt-3 ${sublabelLoading ? 'invisible' : ''}`}
        >
          <div className="h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${getBudgetFillColor(percentage)} transition-all duration-700 ease-out`}
              style={{ width: `${animatedWidth}%` }}
            />
          </div>
          {remainingBudget != null && (
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                예산 {percentage}% 사용
              </span>
              {remainingBudget >= 0 ? (
                <span className="text-[10px] text-grape-500 dark:text-grape-300 font-medium tabular-nums">
                  {formatAmount(remainingBudget)} 남음
                </span>
              ) : (
                <span className="text-[10px] text-red-500 font-medium tabular-nums">
                  {formatAmount(Math.abs(remainingBudget))} 초과
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── 메인 컴포넌트 ───

export default function HeroSummary(props: HeroSummaryProps) {
  // 레거시 props 분기
  if (!isNewProps(props)) {
    return <LegacyHeroSummary {...props} />
  }

  const {
    label,
    totalExpense,
    totalBudget,
    pendingRecurringExpense,
    totalIncome,
    onProgressClick,
    children,
    className = '',
  } = props

  const state = classifyBudgetState(totalExpense, totalBudget, pendingRecurringExpense)

  // 카드 전체를 클릭할 때 이동: 프로그레스바만 특정하지 않고 히어로 영역 전체 클릭 가능
  const cardClickProps = onProgressClick
    ? {
        onClick: onProgressClick,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onProgressClick() },
        className: `card-surface p-6 bg-gradient-to-b from-grape-50/60 to-transparent dark:from-grape-900/30 dark:to-transparent cursor-pointer ${className}`,
      }
    : { className: `card-surface p-6 bg-gradient-to-b from-grape-50/60 to-transparent dark:from-grape-900/30 dark:to-transparent ${className}` }

  return (
    <div {...cardClickProps}>
      <div className="flex justify-between items-baseline">
        {/* "이번 달 지출"로 명확히 표기 — 예산 금액이 큰 숫자처럼 보이는 혼동 방지 */}
        <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
        {totalBudget != null && totalBudget > 0 && (
          <p className="text-xs text-[var(--text-muted)] tabular-nums">예산 {formatAmount(totalBudget)}</p>
        )}
      </div>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(totalExpense)}</p>

      {/* 예산 설정됨 또는 로딩 → 프로그레스바 (클릭 핸들러는 카드 레벨로 이동) */}
      {state.type !== 'noBudget' && (
        <ProgressBar
          state={state}
          totalExpense={totalExpense}
          totalBudget={totalBudget}
          pendingRecurringExpense={pendingRecurringExpense}
        />
      )}

      {/* 예산 미설정 → CTA */}
      {state.type === 'noBudget' && (
        <>
          {/* 수입이 있으면 수입 대비 지출 비율 표시 */}
          {totalIncome != null && totalIncome > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              수입 대비 {Math.round((totalExpense / totalIncome) * 100)}%
            </p>
          )}
          <NoBudgetCta hasRecurring={state.hasRecurring} />
        </>
      )}

      {children}
    </div>
  )
}
