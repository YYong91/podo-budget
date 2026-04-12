import { Link } from 'react-router-dom'
import { formatAmount } from '../../utils/format'
import type { CategoryAmount } from '../../types'

type SavingsSectionProps = {
  savingsTotal: number | undefined      // undefined = is_savings 미설정
  incomeTotal: number
  savingsCategories: CategoryAmount[]   // is_savings=true 카테고리만 필터링된 목록
}

export default function SavingsSection({ savingsTotal, incomeTotal, savingsCategories }: SavingsSectionProps) {
  // 카테고리와 총액이 모두 있어야 유효한 데이터로 판단
  const hasData = savingsCategories.length > 0 && savingsTotal !== undefined

  return (
    <div id="section-savings" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🏦 저축</h2>
        <Link to="/settings/categories" className="text-xs text-grape-600 hover:text-grape-700 transition-colors">
          관리
        </Link>
      </div>

      {hasData ? (
        <>
          <p className="text-xl font-bold text-[var(--text-primary)]">
            {formatAmount(savingsTotal!)}
          </p>
          {incomeTotal > 0 && (
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              수입의 {((savingsTotal! / incomeTotal) * 100).toFixed(1)}%
            </p>
          )}
          <div className="mt-3 space-y-1.5">
            {savingsCategories.map(c => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{c.category}</span>
                <span className="text-sm tabular-nums text-[var(--text-primary)]">{formatAmount(c.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-[var(--text-tertiary)]">저축 카테고리를 설정하면 저축 현황을 볼 수 있어요</p>
          <Link to="/settings/categories" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">
            카테고리 설정 →
          </Link>
        </div>
      )}
    </div>
  )
}
