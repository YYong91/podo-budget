/**
 * @file MilestoneProgress.tsx
 * @description 순자산 마일스톤 프로그레스 — 자동 단위 + 목표 연동
 *
 * 단위 정책:
 *   - 1억 미만  → 500만원 단위
 *   - 1억~5억   → 1000만원 단위
 *   - 5억 이상  → 5000만원 단위
 */

import { formatKoreanAmount } from '../../utils/format'

export interface MilestoneResult {
  unit: number
  prev: number
  next: number
  progressPct: number
}

interface MilestoneProgressProps {
  netWorth: number
  /** 목표가 설정됐는지 여부 — truthy면 마일스톤 바 표시, null이면 설정 CTA 표시 */
  goal: object | null
  onGoalEdit: () => void
}

/** 순자산 크기에 따라 자동 단위 계산 */
export function computeMilestone(netWorth: number): MilestoneResult | null {
  if (netWorth <= 0) return null

  // 단위 결정: 1억 미만 → 500만, 1억~5억 → 1000만, 5억 이상 → 5000만
  const unit =
    netWorth < 100_000_000 ? 5_000_000 :
    netWorth < 500_000_000 ? 10_000_000 :
    50_000_000

  const prev = Math.floor(netWorth / unit) * unit
  // 경계값(prev === netWorth)이면 다음 단위로 전진
  const next = prev + unit
  const progressPct = ((netWorth - prev) / unit) * 100

  return { unit, prev, next, progressPct }
}

export default function MilestoneProgress({ netWorth, goal, onGoalEdit }: MilestoneProgressProps) {
  const milestone = computeMilestone(netWorth)

  if (!milestone) return null

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      {goal ? (
        <>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-[var(--text-secondary)]">다음 목표</p>
            <button
              onClick={onGoalEdit}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              수정
            </button>
          </div>
          <p className="text-lg font-bold text-[var(--text-primary)] mb-3">
            {formatKoreanAmount(milestone.next)}
          </p>
          <div className="h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-grape-400 rounded-full transition-all duration-500"
              style={{ width: `${milestone.progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-[var(--text-muted)]">
            <span>{formatKoreanAmount(milestone.prev)}</span>
            <span>{Math.round(milestone.progressPct)}%</span>
          </div>
        </>
      ) : (
        <button
          onClick={onGoalEdit}
          className="w-full text-left"
        >
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">순자산 목표를 설정해보세요</p>
          <p className="text-xs text-[var(--text-muted)]">목표를 설정하면 진척도를 확인할 수 있어요</p>
        </button>
      )}
    </div>
  )
}
