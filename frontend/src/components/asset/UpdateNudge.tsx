/**
 * @file UpdateNudge.tsx
 * @description 수동 자산 업데이트 넛지 — 30일 이상 미업데이트 자산 감지 시 표시
 */

import { AlertCircle } from 'lucide-react'
import type { Asset } from '../../types'

// 수동 입력 자산 유형 (시세 자동 조회 제외)
const MANUAL_TYPES = ['deposit', 'real_estate', 'other', 'loan']
const NUDGE_THRESHOLD_DAYS = 30

function isStale(asset: Asset): boolean {
  if (!MANUAL_TYPES.includes(asset.type)) return false
  const updatedAt = asset.updated_at ? new Date(asset.updated_at).getTime() : 0
  const daysSince = (Date.now() - updatedAt) / 86_400_000
  return daysSince >= NUDGE_THRESHOLD_DAYS
}

interface UpdateNudgeProps {
  assets: Asset[]
  onNavigate: (assetId: number) => void
}

export default function UpdateNudge({ assets, onNavigate }: UpdateNudgeProps) {
  const staleAssets = assets.filter(isStale)

  // 넛지 표시 조건 미충족 시 렌더링 없음
  if (staleAssets.length === 0) return null

  return (
    <div className="flex items-center gap-3 p-4 bg-warm-50 border border-warm-200 rounded-2xl">
      <AlertCircle className="w-5 h-5 text-warm-600 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-warm-700">
          {staleAssets.length}개 자산 업데이트가 필요해요
        </p>
        <p className="text-xs text-warm-500 truncate">
          {staleAssets.map(a => a.name).join(', ')}
        </p>
      </div>

      <button
        onClick={() => onNavigate(staleAssets[0].id)}
        className="text-xs text-warm-600 hover:text-warm-700 whitespace-nowrap transition-colors"
      >
        확인
      </button>
    </div>
  )
}
