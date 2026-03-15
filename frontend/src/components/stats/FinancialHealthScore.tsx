import type { HealthScore } from '../../types'

interface FinancialHealthScoreProps {
  score: HealthScore | null
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-leaf-600 dark:text-leaf-400'
  if (grade.startsWith('B')) return 'text-grape-600 dark:text-grape-400'
  if (grade.startsWith('C')) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
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

export default function FinancialHealthScore({ score }: FinancialHealthScoreProps) {
  if (!score) return null

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">재정 건강 점수</h3>

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
            <div className="flex-1 h-2 bg-warm-100 rounded-full overflow-hidden">
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
