/**
 * @file AssetOnboarding.tsx
 * @description 자산 없을 때 온보딩 화면 — 유형 그리드로 첫 자산 추가 유도
 */

import { Plus } from 'lucide-react'

interface AssetOnboardingProps {
  onAdd: (type: string) => void
}

const ASSET_TYPES = [
  { type: 'deposit', label: '예·적금', emoji: '🏦' },
  { type: 'stock_kr', label: '국내 주식', emoji: '📈' },
  { type: 'stock_us', label: '해외 주식', emoji: '🌐' },
  { type: 'real_estate', label: '부동산', emoji: '🏠' },
  { type: 'other', label: '기타 자산', emoji: '💼' },
  { type: 'loan', label: '대출', emoji: '📋' },
]

export default function AssetOnboarding({ onAdd }: AssetOnboardingProps) {
  return (
    <div className="text-center py-8">
      <p className="text-lg font-bold text-[var(--text-primary)] mb-1">자산을 기록해볼까요?</p>
      <p className="text-sm text-[var(--text-muted)] mb-6">어떤 자산을 먼저 추가할까요?</p>

      <div className="grid grid-cols-3 gap-3">
        {ASSET_TYPES.map(({ type, label, emoji }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-grape-300 hover:bg-grape-50 transition-colors"
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
          </button>
        ))}
      </div>

      {/* 직접 입력 버튼 */}
      <button
        onClick={() => onAdd('other')}
        className="mt-4 flex items-center justify-center gap-1.5 mx-auto text-sm text-[var(--text-muted)] hover:text-grape-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        직접 추가
      </button>
    </div>
  )
}
