import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { FinancialScore } from '../../types'

type FinancialHealthScoreProps = {
  score: FinancialScore | null
  variant?: 'full' | 'badge'
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-leaf-600'
  if (grade.startsWith('B')) return 'text-grape-600'
  if (grade.startsWith('C')) return 'text-amber-600'
  return 'text-red-600'
}

function getBarColor(value: number): string {
  if (value >= 80) return 'bg-leaf-500'
  if (value >= 60) return 'bg-grape-500'
  if (value >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

const LABELS = [
  { key: 'savingsRate' as const, label: '저축률', weight: 35 },
  { key: 'budgetAdherence' as const, label: '예산 준수율', weight: 25 },
  { key: 'fixedExpenseRatio' as const, label: '고정비 비율', weight: 20 },
  { key: 'spendingStability' as const, label: '소비 안정성', weight: 20 },
]

/** 전체 점수 카드 */
function FullScoreCard({ score }: { score: FinancialScore }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">가계 건강 점수</h3>

      {/* 종합 점수 + 등급 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border-default)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${score.overall} ${100 - score.overall}`}
              className={getGradeColor(score.grade)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
            {score.overall}
          </span>
        </div>
        <div>
          <span className={`text-2xl font-bold ${getGradeColor(score.grade)}`}>{score.grade}</span>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">100점 만점</p>
          {/* 활성 지표 수가 4개 미만이면 안내 텍스트 표시 */}
          {score.activeIndicators < 4 && (
            <p className="text-xs text-warm-400 mt-1">4개 지표 중 {score.activeIndicators}개 기반</p>
          )}
        </div>
      </div>

      {/* 세부 항목: null인 지표는 바 숨기고 detail 텍스트 표시 */}
      <div className="space-y-2">
        {LABELS.map(({ key, label }) => {
          const indicatorScore = score[key]
          const breakdown = score.breakdown[key]
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-xs text-[var(--text-secondary)] shrink-0">{label}</span>
                {indicatorScore !== null
                  ? <span className="text-xs font-medium text-[var(--text-secondary)]">{indicatorScore}점</span>
                  : <span className="text-warm-400 text-xs">{breakdown.detail ?? '데이터 없음'}</span>}
              </div>
              {indicatorScore !== null && (
                <div className="h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(indicatorScore)}`}
                    style={{ width: `${indicatorScore}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 소형 배지 + 클릭 시 바텀시트로 전체 점수 표시 */
function BadgeMode({ score }: { score: FinancialScore }) {
  const [open, setOpen] = useState(false)

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border ${getGradeColor(score.grade)} border-current bg-white/80 dark:bg-black/20 hover:opacity-80 transition-opacity`}
      >
        <span>{score.grade}</span>
        <span className="text-xs font-normal opacity-70">{score.overall}</span>
      </button>

      {open && createPortal(
        <>
          {/* 배경 오버레이: document.body에 Portal로 렌더링 → HeroSummary 버블링 완전 차단 */}
          <button
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 cursor-default w-full h-full"
            aria-label="모달 닫기"
          />
          {/* 카드 컨테이너: 스크롤 가능, 화면 90% 높이 제한 */}
          <div className="fixed inset-0 z-[51] flex items-end sm:items-center justify-center pointer-events-none">
            <div
              role="presentation"
              className="pointer-events-auto relative w-full sm:max-w-sm mx-auto p-4 pb-8 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div role="dialog" aria-modal="true" aria-label="가계 건강점수">
                <div className="flex justify-end mb-1">
                  <button
                    aria-label="건강점수 닫기"
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-tertiary)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 전체 점수 카드 */}
                <FullScoreCard score={score} />

                {/* 지표별 요약 */}
                <div className="mt-3 bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)]">지표별 분석</h4>
                  {LABELS.map(({ key, label }) => {
                    const breakdown = score.breakdown[key]
                    return (
                      <div key={key} className="space-y-0.5">
                        <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{breakdown.summary}</p>
                        {breakdown.detail && (
                          <p className="text-xs text-warm-400">{breakdown.detail}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

export default function FinancialHealthScore({ score, variant = 'full' }: FinancialHealthScoreProps) {
  if (!score) return null
  if (variant === 'badge') return <BadgeMode score={score} />
  return <FullScoreCard score={score} />
}
