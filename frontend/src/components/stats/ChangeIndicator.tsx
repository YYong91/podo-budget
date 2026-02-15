/**
 * @file ChangeIndicator.tsx
 * @description 변화량을 5단계로 시각화하는 컴포넌트
 */

interface ChangeIndicatorProps {
  percentage: number | null
  compact?: boolean
}

type ChangeLevel = {
  label: string
  icon: string
  colorClass: string
}

function getChangeLevel(pct: number): ChangeLevel {
  if (pct > 20) return { label: '많이 늘음', icon: '▲▲', colorClass: 'text-rose-600' }
  if (pct > 5) return { label: '조금 늘음', icon: '▲', colorClass: 'text-rose-400' }
  if (pct >= -5) return { label: '보통', icon: '─', colorClass: 'text-stone-400' }
  if (pct >= -20) return { label: '줄음', icon: '▼', colorClass: 'text-emerald-400' }
  return { label: '많이 줄음', icon: '▼▼', colorClass: 'text-emerald-600' }
}

export default function ChangeIndicator({ percentage, compact = false }: ChangeIndicatorProps) {
  if (percentage === null) {
    return <span className="text-sm text-stone-300">비교 불가</span>
  }

  const level = getChangeLevel(percentage)
  const sign = percentage > 0 ? '+' : ''

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${level.colorClass}`}>
        <span data-testid="change-icon">{level.icon}</span>
        <span>{sign}{percentage.toFixed(1)}%</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${level.colorClass}`}>
      <span data-testid="change-icon">{level.icon}</span>
      <span>{level.label}</span>
      <span className="text-xs opacity-75">({sign}{percentage.toFixed(1)}%)</span>
    </span>
  )
}
