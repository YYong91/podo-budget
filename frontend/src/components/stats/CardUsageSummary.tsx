/**
 * @file CardUsageSummary.tsx
 * @description 결제수단(카드) 실적 요약 섹션 (#305)
 * monthly_target이 있는 결제수단만 프로그레스 바로 표시한다.
 * BudgetVsActual과 유사한 스타일을 사용한다.
 */

import { Link } from 'react-router-dom'
import { CreditCard, Pencil } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { PaymentMethodUsage } from '../../types'

interface CardUsageSummaryProps {
  usage: PaymentMethodUsage[]
}

export default function CardUsageSummary({ usage }: CardUsageSummaryProps) {
  // monthly_target이 있는 항목만 표시
  const targetUsage = usage.filter((u) => u.monthly_target != null)

  if (targetUsage.length === 0) return null

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6" data-testid="card-usage-summary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-grape-600" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">카드 실적</h2>
        </div>
        <Link to="/payment-methods" className="flex items-center gap-1 text-xs text-grape-600 hover:text-grape-700 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
          편집
        </Link>
      </div>

      <div className="space-y-3">
        {targetUsage.map((item) => {
          const pct = item.usage_percentage ?? 0
          return (
            <div key={item.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${pct > 100 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                    {formatAmount(item.spent_amount)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]"> / {formatAmount(item.monthly_target!)}</span>
                </div>
              </div>
              <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-grape-500'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-[var(--text-muted)]">
                  {pct.toFixed(1)}%
                </span>
                {item.remaining != null && (
                  <span className="text-xs text-[var(--text-muted)]">
                    잔여 {formatAmount(item.remaining)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
