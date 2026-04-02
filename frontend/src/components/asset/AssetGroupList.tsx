/**
 * @file AssetGroupList.tsx
 * @description 유형별 자산 그룹 목록 — 그룹 합계 + 대출 진척도 per-item
 */

import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { Asset } from '../../types'

interface AssetGroupListProps {
  assets: Asset[]
  onAdd: (type?: string) => void
}

const ASSET_GROUPS: { label: string; types: string[]; isLiability?: boolean }[] = [
  { label: '투자', types: ['stock_kr', 'stock_us', 'crypto'] },
  { label: '예적금', types: ['deposit'] },
  { label: '부동산', types: ['real_estate'] },
  { label: '기타', types: ['other'] },
  { label: '부채 (대출)', types: ['loan'], isLiability: true },
]

export default function AssetGroupList({ assets, onAdd }: AssetGroupListProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-3">
      {ASSET_GROUPS.map(group => {
        const groupAssets = assets.filter(a => group.types.includes(a.type))
        if (groupAssets.length === 0) return null

        const total = groupAssets.reduce((s, a) => s + (a.manual_value ?? a.current_value ?? 0), 0)

        return (
          <div
            key={group.label}
            className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-4"
          >
            {/* 그룹 헤더 */}
            <div className="flex justify-between items-center mb-3">
              <h3
                className={`text-sm font-semibold ${group.isLiability ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}
              >
                {group.label}
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${group.isLiability ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}
                >
                  {formatAmount(total)}
                </span>
                <button
                  onClick={() => onAdd(group.types[0])}
                  className="p-1 rounded-full hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label={`${group.label} 추가`}
                >
                  <Plus className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* 자산 항목 목록 */}
            <div className="space-y-2">
              {groupAssets.map(asset => {
                const value = asset.manual_value ?? asset.current_value ?? 0

                // 대출 상환 진척도: original_amount 있을 때만 계산
                const repaidPct =
                  asset.original_amount && asset.original_amount > 0
                    ? ((asset.original_amount - value) / asset.original_amount) * 100
                    : null

                const clampedPct =
                  repaidPct !== null ? Math.max(0, Math.min(100, repaidPct)) : null

                return (
                  <div key={asset.id}>
                    <button
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="w-full flex justify-between items-center py-1 hover:bg-[var(--surface-hover)] rounded-lg px-1 transition-colors"
                    >
                      <span className="text-sm text-[var(--text-secondary)] truncate">
                        {asset.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-medium ${group.isLiability ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}
                        >
                          {formatAmount(value)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      </div>
                    </button>

                    {/* 대출 상환 진척도 바 */}
                    {clampedPct !== null && (
                      <div className="mt-1 px-1">
                        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-0.5">
                          <span>상환 진척도</span>
                          <span>{Math.round(clampedPct)}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-leaf-400 rounded-full transition-all duration-500"
                            style={{ width: `${clampedPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* 전체 자산 추가 버튼 */}
      <button
        onClick={() => onAdd(undefined)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:border-grape-300 hover:text-grape-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        자산 추가
      </button>
    </div>
  )
}
