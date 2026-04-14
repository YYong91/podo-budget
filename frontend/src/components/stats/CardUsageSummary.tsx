/**
 * @file CardUsageSummary.tsx
 * @description 결제수단(카드) 실적 요약 섹션 (#305)
 * monthly_target이 있는 결제수단만 표시한다.
 * 기본 접힘 상태에서 달성/진행 오버뷰를 보여주고, 펼치면 카드별 상세 프로그레스를 표시한다.
 */

import { useState } from 'react'
import { formatAmount } from '../../utils/format'
import type { PaymentMethodUsage } from '../../types'
import SectionHeader from './SectionHeader'

interface CardUsageSummaryProps {
  usage: PaymentMethodUsage[]
}

// 접힌 상태에서 표시하는 오버뷰 (달성/진행 현황)
function UsageOverview({ targetUsage }: { targetUsage: PaymentMethodUsage[] }) {
  const achievedCount = targetUsage.filter(u => (u.usage_percentage ?? 0) >= 100).length
  const inProgressCount = targetUsage.length - achievedCount

  // 카드가 1개일 때: 카드 이름 + 달성률 표시, 달성 건수도 함께 표시
  if (targetUsage.length === 1) {
    const item = targetUsage[0]
    const pct = item.usage_percentage ?? 0
    const achieved = pct >= 100
    return (
      <p className="text-sm text-[var(--text-secondary)] mt-2">
        {item.name}{' '}
        <span className={achieved ? 'text-leaf-600 font-medium' : ''}>{pct.toFixed(1)}%</span>
        {achieved
          ? ' · ✅ 실적 달성'
          : item.remaining != null
            ? ` · 잔여 ${formatAmount(item.remaining)}`
            : null}
      </p>
    )
  }

  return (
    <p className="text-sm text-[var(--text-secondary)] mt-2">
      {achievedCount > 0 && <span className="text-leaf-600">달성 {achievedCount}개</span>}
      {achievedCount > 0 && inProgressCount > 0 && ' · '}
      {inProgressCount > 0 && `진행 중 ${inProgressCount}개`}
    </p>
  )
}

export default function CardUsageSummary({ usage }: CardUsageSummaryProps) {
  const [expanded, setExpanded] = useState(false)
  // monthly_target이 있는 항목만 표시
  const targetUsage = usage.filter((u) => u.monthly_target != null)

  if (targetUsage.length === 0) return null

  return (
    <div
      className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6"
      data-testid="card-usage-summary"
    >
      <SectionHeader
        icon="💳"
        title="카드 실적"
        manageTo="/payment-methods"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
      />

      {/* 접힌 오버뷰 */}
      {!expanded && <UsageOverview targetUsage={targetUsage} />}

      {/* 펼침: 카드별 상세 */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {targetUsage.map((item) => {
            const pct = item.usage_percentage ?? 0
            return (
              <div key={item.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${pct >= 100 ? 'text-leaf-600' : 'text-[var(--text-primary)]'}`}>
                      {formatAmount(item.spent_amount)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]"> / {formatAmount(item.monthly_target!)}</span>
                  </div>
                </div>
                <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      pct >= 100 ? 'bg-leaf-500' : pct >= 80 ? 'bg-grape-500' : 'bg-grape-400'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs text-[var(--text-muted)]">{pct.toFixed(1)}%</span>
                  {item.remaining != null && (
                    <span className={`text-xs ${pct >= 100 ? 'text-leaf-600 font-medium' : 'text-[var(--text-muted)]'}`}>
                      {pct >= 100 ? '✅ 실적 달성' : `잔여 ${formatAmount(item.remaining)}`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
