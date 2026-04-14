import { useState } from 'react'
import type { HealthScore } from '../../types'

type FinancialHealthScoreProps = {
  score: HealthScore | null
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
  { key: 'savings' as const, label: '저축' },
  { key: 'spending' as const, label: '지출 관리' },
  { key: 'debt' as const, label: '부채' },
]

/** 전체 점수 카드 */
function FullScoreCard({ score }: { score: HealthScore }) {
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
        </div>
      </div>

      {/* 세부 항목 */}
      <div className="space-y-2">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] w-14 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(score[key])}`}
                style={{ width: `${score[key]}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)] w-8 text-right">{score[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 소형 배지 + 클릭 시 바텀시트로 전체 점수 표시 */
function BadgeMode({ score }: { score: HealthScore }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border ${getGradeColor(score.grade)} border-current bg-white/80 dark:bg-black/20 hover:opacity-80 transition-opacity`}
      >
        <span>{score.grade}</span>
        <span className="text-xs font-normal opacity-70">{score.overall}</span>
      </button>

      {open && (
        <>
          {/* 배경 버튼: fixed inset-0으로 전체 화면 커버. 클릭 시 닫기 + HeroSummary 버블링 차단 */}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            className="fixed inset-0 z-50 bg-black/40 w-full cursor-default"
            aria-label="모달 닫기"
          />
          {/* 카드 컨테이너: pointer-events-none → 카드 외부 클릭은 backdrop 버튼에 전달 */}
          <div className="fixed inset-0 z-[51] flex items-end sm:items-center justify-center pointer-events-none">
            {/* role="presentation" + onClick: 카드 클릭이 HeroSummary로 버블링되지 않도록 차단 */}
            <div
              role="presentation"
              className="pointer-events-auto relative w-full sm:max-w-sm mx-auto p-4 pb-8"
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
                <FullScoreCard score={score} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function FinancialHealthScore({ score, variant = 'full' }: FinancialHealthScoreProps) {
  if (!score) return null
  if (variant === 'badge') return <BadgeMode score={score} />
  return <FullScoreCard score={score} />
}
