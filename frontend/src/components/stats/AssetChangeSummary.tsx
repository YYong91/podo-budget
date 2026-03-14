import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { AssetSummary, AssetSnapshot } from '../../types'
import { formatAmount } from '../../utils/format'

interface AssetChangeSummaryProps {
  summary: AssetSummary | null
  previousSnapshot: AssetSnapshot | null
}

const TYPE_LABELS: Record<string, string> = {
  stock_kr: '국내주식',
  stock_us: '해외주식',
  crypto: '암호화폐',
  deposit: '예적금',
  real_estate: '부동산',
  other: '기타',
  loan: '대출',
}

export default function AssetChangeSummary({ summary, previousSnapshot }: AssetChangeSummaryProps) {
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4 text-center">
        <p className="text-sm text-warm-500 mb-2">자산을 등록하면 더 풍부한 리포트를 볼 수 있어요</p>
        <Link to="/assets" className="text-sm font-medium text-grape-600 hover:text-grape-700">
          자산 등록하기 →
        </Link>
      </div>
    )
  }

  const change = previousSnapshot ? summary.net_worth - previousSnapshot.net_worth : null
  const changeRate =
    previousSnapshot && previousSnapshot.net_worth !== 0
      ? ((change ?? 0) / Math.abs(previousSnapshot.net_worth)) * 100
      : null

  // 유형별 증감 (이전 스냅샷이 있을 때만)
  const typeChanges = previousSnapshot?.breakdown
    ? Object.entries(summary.breakdown)
        .map(([type, amount]) => ({
          type,
          label: TYPE_LABELS[type] || type,
          current: amount,
          previous: previousSnapshot.breakdown?.[type] ?? 0,
          change: amount - (previousSnapshot.breakdown?.[type] ?? 0),
        }))
        .filter((tc) => tc.current > 0 || tc.previous > 0)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    : []

  // 만원/억원 포맷
  const formatLargeAmount = (amount: number): string => {
    const abs = Math.abs(amount)
    if (abs >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`
    if (abs >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`
    return formatAmount(amount)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
      <h3 className="text-sm font-semibold text-warm-700 mb-3">자산 변동</h3>

      {/* 순자산 */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs text-warm-500">순자산</p>
          <p className="text-xl font-bold text-warm-900">{formatLargeAmount(summary.net_worth)}</p>
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 ${change >= 0 ? 'text-leaf-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-sm font-medium">
              전월 대비 {change >= 0 ? '+' : ''}
              {formatLargeAmount(change)}
            </span>
            {changeRate !== null && (
              <span className="text-xs text-warm-500">
                ({changeRate >= 0 ? '+' : ''}
                {changeRate.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* 유형별 증감 */}
      {typeChanges.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-warm-100">
          {typeChanges.slice(0, 5).map((tc) => (
            <div key={tc.type} className="flex items-center justify-between text-xs">
              <span className="text-warm-600">{tc.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-warm-700">{formatLargeAmount(tc.current)}</span>
                {tc.change !== 0 && (
                  <span className={tc.change > 0 ? 'text-leaf-600' : 'text-red-500'}>
                    {tc.change > 0 ? '+' : ''}
                    {formatLargeAmount(tc.change)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
